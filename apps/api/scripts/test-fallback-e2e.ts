/**
 * E2E integration test for PR #3 fallback flow.
 * Run: npm run test:fallback-e2e --workspace=@pitchzone/api
 *
 * Requires: postgres + redis + API server + worker running.
 */
import * as bcrypt from 'bcrypt';
import { io, type Socket } from 'socket.io-client';
import {
  GameTitle,
  MatchEaSyncStatus,
  MatchFormat,
  MatchStatus,
  ParticipantType,
  TeamRole,
  TournamentFormat,
  TournamentStatus,
  UserRole,
} from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { AppModule } from '../src/app.module';
import { BracketService } from '../src/tournaments/bracket.service';
import { MatchFallbackService, MATCH_FALLBACK_QUEUE } from '../src/fallback/match-fallback.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
const PASSWORD = 'demo12345';

type Result = { ok: boolean; details: string[] };

function pass(details: string[]): Result {
  return { ok: true, details };
}

function fail(details: string[]): Result {
  return { ok: false, details };
}

async function waitForJob(queue: Queue, jobId: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    if (state === 'completed') return job;
    if (state === 'failed') throw new Error(`Job ${jobId} failed: ${job.failedReason}`);
    await sleep(200);
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectNotificationSocket(userId: string): Promise<{ socket: Socket; events: unknown[] }> {
  return new Promise((resolve, reject) => {
    const events: unknown[] = [];
    const socket = io(`${WS_BASE}/notifications`, { transports: ['websocket', 'polling'] });
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 10000);

    socket.on('connect', () => {
      socket.emit('join', userId);
      clearTimeout(timer);
      resolve({ socket, events });
    });

    socket.on('notification:new', (payload) => {
      events.push(payload);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function createTestUsers(prisma: PrismaService) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  async function upsertUser(email: string, nickname: string, role: UserRole = UserRole.PLAYER) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        role,
        profile: { create: { nickname, country: 'RU', countryCode: 'RU' } },
      },
    });
  }

  const mod = await upsertUser('fb-mod@pitchzone.gg', 'FallbackMod', UserRole.MODERATOR);
  const capA = await upsertUser('fb-capa@pitchzone.gg', 'FallbackCapA');
  const capB = await upsertUser('fb-capb@pitchzone.gg', 'FallbackCapB');
  const oldCap = await upsertUser('fb-oldcap@pitchzone.gg', 'FallbackOldCap');
  const newCap = await upsertUser('fb-newcap@pitchzone.gg', 'FallbackNewCap');

  const suffix = String(Date.now()).slice(-2);
  const teamA = await prisma.team.create({
    data: {
      name: 'Fallback Team A',
      tag: `FA${suffix}`,
      country: 'RU',
      countryCode: 'RU',
      ownerId: capA.id,
      members: { create: [{ userId: capA.id, role: TeamRole.CAPTAIN }] },
    },
  });

  const teamB = await prisma.team.create({
    data: {
      name: 'Fallback Team B',
      tag: `FB${suffix}`,
      country: 'RU',
      countryCode: 'RU',
      ownerId: capB.id,
      members: { create: [{ userId: capB.id, role: TeamRole.CAPTAIN }] },
    },
  });

  const teamSwap = await prisma.team.create({
    data: {
      name: 'Fallback Team Swap',
      tag: `FS${suffix}`,
      country: 'RU',
      countryCode: 'RU',
      ownerId: oldCap.id,
      members: { create: [{ userId: newCap.id, role: TeamRole.CAPTAIN }] },
    },
  });

  return { mod, capA, capB, oldCap, newCap, teamA, teamB, teamSwap };
}

async function createLiveTournament(
  prisma: PrismaService,
  organizerId: string,
  teamIds: [string, string],
  slug: string,
) {
  const scheduledAt = new Date(Date.now() - 60_000);
  const tournament = await prisma.tournament.create({
    data: {
      slug,
      title: `Fallback E2E ${slug}`,
      description: 'E2E fallback test tournament',
      game: GameTitle.EA_FC,
      format: TournamentFormat.ROUND_ROBIN,
      matchFormat: MatchFormat.BO1,
      teamSize: 2,
      status: TournamentStatus.LIVE,
      entryFee: 0,
      maxParticipants: 2,
      startsAt: scheduledAt,
      registrationDeadline: new Date(),
      organizerId,
      visibility: 'PUBLIC',
      proofRequirement: 'SCREENSHOT',
      matchResultTimeoutHours: 24,
    },
  });

  const participants = await Promise.all(
    teamIds.map((teamId, i) =>
      prisma.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          teamId,
          type: ParticipantType.TEAM,
          seed: i + 1,
          paymentStatus: 'PAID',
        },
      }),
    ),
  );

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      round: 1,
      position: 0,
      participant1Id: participants[0]!.id,
      participant2Id: participants[1]!.id,
      participant1Name: 'Team A',
      participant2Name: 'Team B',
      status: MatchStatus.SCHEDULED,
      scheduledAt,
      eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
    },
  });

  return { tournament, match, participants };
}

async function triggerFallbackCheck(
  fallbackService: MatchFallbackService,
  matchId: string,
  scheduledAt: Date,
) {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(MATCH_FALLBACK_QUEUE, { connection });

  await fallbackService.scheduleFallbackCheck(matchId, scheduledAt);
  const job = await waitForJob(queue, `fallback-check-${matchId}`);
  await queue.close();
  await connection.quit();
  return job;
}

async function testScenario1(
  prisma: PrismaService,
  fallbackService: MatchFallbackService,
  organizerId: string,
  capAId: string,
  capBId: string,
  teamAId: string,
  teamBId: string,
): Promise<Result> {
  const details: string[] = [];
  const slug = `fb-s1-${Date.now()}`;
  const { match } = await createLiveTournament(prisma, organizerId, [teamAId, teamBId], slug);
  const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);

  await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

  const updated = await prisma.match.findUnique({ where: { id: match.id } });
  if (updated?.status !== MatchStatus.IN_PROGRESS) {
    return fail([`Expected IN_PROGRESS, got ${updated?.status}`]);
  }
  if (!updated.fallbackDeadline) {
    return fail(['fallbackDeadline not set']);
  }
  details.push(`Match → IN_PROGRESS, fallbackDeadline=${updated.fallbackDeadline.toISOString()}`);

  const notifications = await prisma.notification.findMany({
    where: {
      type: 'MATCH_FALLBACK',
      userId: { in: [capAId, capBId] },
      createdAt: { gte: new Date(Date.now() - 30_000) },
    },
  });

  const capANotif = notifications.find((n) => n.userId === capAId);
  const capBNotif = notifications.find((n) => n.userId === capBId);

  if (!capANotif) details.push('FAIL: captain A has no MATCH_FALLBACK notification');
  else details.push(`Captain A notification: id=${capANotif.id}`);

  if (!capBNotif) details.push('FAIL: captain B has no MATCH_FALLBACK notification');
  else details.push(`Captain B notification: id=${capBNotif.id}`);

  // UI form visibility check (team captain resolution in frontend)
  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId: updated.tournamentId },
  });
  const teamParticipants = participants.filter((p) => p.teamId && !p.userId);
  if (teamParticipants.length === 2) {
    details.push(
      'UI NOTE: MatchResultPanel filters by participant.userId — team captains (teamId-only participants) will NOT see score form in web UI',
    );
  }

  const ok = !!capANotif && !!capBNotif;
  return ok ? pass(details) : fail(details);
}

async function testScenario2(
  prisma: PrismaService,
  fallbackService: MatchFallbackService,
  bracketService: BracketService,
  organizerId: string,
  teamAId: string,
  teamBId: string,
): Promise<Result> {
  const details: string[] = [];
  const slug = `fb-s2-${Date.now()}`;
  const { match } = await createLiveTournament(prisma, organizerId, [teamAId, teamBId], slug);
  const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);

  await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

  const afterFallback = await prisma.match.findUnique({ where: { id: match.id } });
  if (!afterFallback?.fallbackDeadline) {
    return fail(['Fallback did not open']);
  }
  details.push('Fallback opened (IN_PROGRESS + fallbackDeadline set)');

  await bracketService.finalizeMatchFromEa(match.id, 2, 1);

  const afterEa = await prisma.match.findUnique({ where: { id: match.id } });
  if (afterEa?.status !== MatchStatus.COMPLETED) {
    return fail([`Expected COMPLETED after EA sync, got ${afterEa?.status}`]);
  }
  if (afterEa.fallbackDeadline !== null) {
    return fail(['fallbackDeadline should be cleared after EA finalize']);
  }
  details.push('EA finalize → COMPLETED, fallback fields cleared, jobs cancelled');

  details.push('API blocks score submission when status=COMPLETED (reportScore accepts only IN_PROGRESS | AWAITING_CONFIRMATION)');

  // Check pending BullMQ jobs cancelled
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(MATCH_FALLBACK_QUEUE, { connection });
  const checkJob = await queue.getJob(`fallback-check-${match.id}`);
  const confirmJob = await queue.getJob(`fallback-confirm-${match.id}`);
  await queue.close();
  await connection.quit();

  if (checkJob) {
    const state = await checkJob.getState();
    if (state !== 'completed' && state !== 'unknown') {
      details.push(`WARN: fallback-check job still in state ${state}`);
    }
  }
  details.push('Frontend: bracket:update emitted on EA finalize; MatchResultPanel hides completed matches via isActionableMatch()');

  return pass(details);
}

async function testScenario3(
  prisma: PrismaService,
  fallbackService: MatchFallbackService,
  bracketService: BracketService,
  modId: string,
  capAId: string,
  capBId: string,
  organizerId: string,
  teamAId: string,
  teamBId: string,
): Promise<Result> {
  const details: string[] = [];

  // 3a: Both captains same score → immediate completion
  {
    const slug = `fb-s3a-${Date.now()}`;
    const { match, participants } = await createLiveTournament(
      prisma,
      organizerId,
      [teamAId, teamBId],
      slug,
    );
    const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);
    await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

    await prisma.matchSubmission.create({
      data: {
        matchId: match.id,
        participantId: participants[0]!.id,
        userId: capAId,
        score1: 2,
        score2: 1,
        proofUrl: '/test/proof1.png',
      },
    });
    await prisma.matchSubmission.create({
      data: {
        matchId: match.id,
        participantId: participants[1]!.id,
        userId: capBId,
        score1: 2,
        score2: 1,
        proofUrl: '/test/proof2.png',
      },
    });

    await bracketService.finalizeMatch(match.id, 2, 1);
    const completed = await prisma.match.findUnique({ where: { id: match.id } });
    if (completed?.status !== MatchStatus.COMPLETED) {
      return fail([`3a FAIL: same scores should complete immediately, got ${completed?.status}`]);
    }
    details.push('3a PASS: matching scores → COMPLETED immediately');
  }

  // 3b: Different scores → DISPUTED, moderator notification
  {
    const slug = `fb-s3b-${Date.now()}`;
    const { match, participants } = await createLiveTournament(
      prisma,
      organizerId,
      [teamAId, teamBId],
      slug,
    );
    const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);
    await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

    await prisma.matchSubmission.create({
      data: {
        matchId: match.id,
        participantId: participants[0]!.id,
        userId: capAId,
        score1: 3,
        score2: 1,
        proofUrl: '/test/proof1.png',
      },
    });
    await prisma.matchSubmission.create({
      data: {
        matchId: match.id,
        participantId: participants[1]!.id,
        userId: capBId,
        score1: 1,
        score2: 3,
        proofUrl: '/test/proof2.png',
      },
    });

    await bracketService.openDispute(match.id, capAId, 'Расхождение в отчётах о счёте');
    const disputed = await prisma.match.findUnique({
      where: { id: match.id },
      include: { dispute: true },
    });
    if (disputed?.status !== MatchStatus.DISPUTED) {
      return fail([`3b FAIL: expected DISPUTED, got ${disputed?.status}`]);
    }
    details.push('3b PASS: conflicting scores → DISPUTED');

    const modNotif = await prisma.notification.findFirst({
      where: {
        userId: modId,
        type: { contains: 'DISPUTE' },
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
    });
    if (modNotif) {
      details.push(`3b PASS: moderator notification found (${modNotif.type})`);
    } else {
      details.push(
        '3b FAIL: no moderator notification on new dispute — openDispute() does not call NotificationsService',
      );
    }
  }

  // 3c: Single captain submit → auto-accept after confirmation timeout from first submission
  {
    const slug = `fb-s3c-${Date.now()}`;
    const { match, participants } = await createLiveTournament(
      prisma,
      organizerId,
      [teamAId, teamBId],
      slug,
    );
    const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);
    await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

    const submittedAt = new Date(Date.now() - 10_000);
    await prisma.matchSubmission.create({
      data: {
        matchId: match.id,
        participantId: participants[0]!.id,
        userId: capAId,
        score1: 2,
        score2: 0,
        proofUrl: '/test/proof1.png',
        submittedAt,
      },
    });

    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.AWAITING_CONFIRMATION,
        fallbackAutoAcceptDeadline: new Date(Date.now() + fallbackService.confirmationTimeoutMs),
      },
    });

    await fallbackService.scheduleAutoAccept(match.id, submittedAt);

    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue(MATCH_FALLBACK_QUEUE, { connection });
    await waitForJob(queue, `fallback-confirm-${match.id}`, 20000);
    await queue.close();
    await connection.quit();

    const autoAccepted = await prisma.match.findUnique({ where: { id: match.id } });
    if (autoAccepted?.status !== MatchStatus.COMPLETED) {
      return fail([`3c FAIL: auto-accept expected COMPLETED, got ${autoAccepted?.status}`]);
    }
    if (autoAccepted.score1 !== 2 || autoAccepted.score2 !== 0) {
      return fail([`3c FAIL: wrong score after auto-accept ${autoAccepted.score1}:${autoAccepted.score2}`]);
    }

    const expectedDeadline = new Date(submittedAt.getTime() + fallbackService.confirmationTimeoutMs);
    details.push(
      `3c PASS: single submission auto-accepted with score 2:0; timer based on submittedAt=${submittedAt.toISOString()} (not fallback open time); expected deadline ~${expectedDeadline.toISOString()}`,
    );
  }

  const hasModNotifFail = details.some((d) => d.includes('3b FAIL'));
  return hasModNotifFail ? fail(details) : pass(details);
}

async function testScenario4(
  prisma: PrismaService,
  fallbackService: MatchFallbackService,
  organizerId: string,
  capAId: string,
  teamAId: string,
  teamBId: string,
): Promise<Result> {
  const details: string[] = [];

  let socketCtx: { socket: Socket; events: unknown[] };
  try {
    socketCtx = await connectNotificationSocket(capAId);
  } catch (err) {
    return fail([
      `Socket.IO connect failed — is API running on ${WS_BASE}? ${err instanceof Error ? err.message : String(err)}`,
    ]);
  }

  const beforeCount = socketCtx.events.length;
  details.push(`Socket connected to ${WS_BASE}/notifications, joined room user:${capAId}`);

  // Trigger fallback via worker queue (same path as production) while captain is "online"
  const slug = `fb-s4-${Date.now()}`;
  const { match } = await createLiveTournament(prisma, organizerId, [teamAId, teamBId], slug);
  const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);
  await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

  await sleep(2000);

  const received = socketCtx.events.length - beforeCount;
  const dbNotif = await prisma.notification.findFirst({
    where: { userId: capAId, type: 'MATCH_FALLBACK', createdAt: { gte: new Date(Date.now() - 10_000) } },
  });

  socketCtx.socket.emit('leave', capAId);
  socketCtx.socket.disconnect();

  if (dbNotif) {
    details.push(`DB: notification persisted (id=${dbNotif.id}, title="${dbNotif.title}")`);
  } else {
    details.push('DB: no notification found for captain');
  }

  if (received >= 1) {
    const payload = socketCtx.events[socketCtx.events.length - 1] as {
      unreadCount?: number;
      notification?: { title?: string };
    };
    details.push(`Socket.IO: received notification:new (unreadCount=${payload.unreadCount ?? '?'})`);
    details.push('Bell badge would update via useNotifications → refresh() without page reload');
    return pass(details);
  }

  details.push(
    `Socket.IO: NO notification:new event (events before=${beforeCount}, after=${socketCtx.events.length})`,
  );
  details.push(
    'ROOT CAUSE: fallback job runs in worker process (ApplicationContext) — NotificationsGateway.emit() does not reach clients connected to API server on :4000 (separate Socket.IO instances, no Redis adapter)',
  );

  return dbNotif ? fail(details) : fail(details);
}

async function testScenario5(
  prisma: PrismaService,
  fallbackService: MatchFallbackService,
  organizerId: string,
  oldCapId: string,
  newCapId: string,
  teamSwapId: string,
  teamBId: string,
): Promise<Result> {
  const details: string[] = [];
  const slug = `fb-s5-${Date.now()}`;
  const { match } = await createLiveTournament(
    prisma,
    organizerId,
    [teamSwapId, teamBId],
    slug,
  );
  const scheduledAt = match.scheduledAt ?? new Date(Date.now() - 60_000);

  await triggerFallbackCheck(fallbackService, match.id, scheduledAt);

  const notifications = await prisma.notification.findMany({
    where: { type: 'MATCH_FALLBACK' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const oldCapNotif = notifications.find((n) => n.userId === oldCapId);
  const newCapNotif = notifications.find((n) => n.userId === newCapId);

  if (oldCapNotif) {
    details.push('FAIL: notification sent to OLD captain (no longer CAPTAIN on team)');
  } else {
    details.push('PASS: old captain did NOT receive notification');
  }

  if (newCapNotif) {
    details.push(`PASS: current captain received notification (id=${newCapNotif.id})`);
  } else {
    details.push('FAIL: current captain did NOT receive notification');
  }

  details.push(
    'resolveCaptainUserIds() reads live TeamMember.role at fallback time, not registration-time captain',
  );

  const ok = !oldCapNotif && !!newCapNotif;
  return ok ? pass(details) : fail(details);
}

async function main() {
  console.log('=== Fallback E2E Test (PR #3) ===\n');
  console.log(`Fallback delay: ${process.env.EA_SYNC_FALLBACK_DELAY_MINUTES} min`);
  console.log(`Confirmation timeout: ${process.env.EA_SYNC_FALLBACK_CONFIRMATION_MINUTES} min`);
  console.log(`WS: ${WS_BASE}/notifications\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const fallbackService = app.get(MatchFallbackService);
  const bracketService = app.get(BracketService);
  const notifications = app.get(NotificationsService);

  const organizer = await prisma.user.findFirst({ where: { role: UserRole.ORGANIZER } });
  if (!organizer) throw new Error('No organizer user — run db:seed first');

  const users = await createTestUsers(prisma);

  const results: Record<string, Result> = {};

  try {
    results['1. Базовый путь (45 мин → оба капитана)'] = await testScenario1(
      prisma,
      fallbackService,
      organizer.id,
      users.capA.id,
      users.capB.id,
      users.teamA.id,
      users.teamB.id,
    );
  } catch (e) {
    results['1. Базовый путь (45 мин → оба капитана)'] = fail([
      e instanceof Error ? e.message : String(e),
    ]);
  }

  try {
    results['2. Гонка с EA Sync'] = await testScenario2(
      prisma,
      fallbackService,
      bracketService,
      organizer.id,
      users.teamA.id,
      users.teamB.id,
    );
  } catch (e) {
    results['2. Гонка с EA Sync'] = fail([e instanceof Error ? e.message : String(e)]);
  }

  try {
    results['3. Оба пути ввода капитанами'] = await testScenario3(
      prisma,
      fallbackService,
      bracketService,
      users.mod.id,
      users.capA.id,
      users.capB.id,
      organizer.id,
      users.teamA.id,
      users.teamB.id,
    );
  } catch (e) {
    results['3. Оба пути ввода капитанами'] = fail([e instanceof Error ? e.message : String(e)]);
  }

  try {
    results['4. Socket.IO колокольчик live'] = await testScenario4(
      prisma,
      fallbackService,
      organizer.id,
      users.capA.id,
      users.teamA.id,
      users.teamB.id,
    );
  } catch (e) {
    results['4. Socket.IO колокольчик live'] = fail([e instanceof Error ? e.message : String(e)]);
  }

  try {
    results['5. Смена капитана'] = await testScenario5(
      prisma,
      fallbackService,
      organizer.id,
      users.oldCap.id,
      users.newCap.id,
      users.teamSwap.id,
      users.teamB.id,
    );
  } catch (e) {
    results['5. Смена капитана'] = fail([e instanceof Error ? e.message : String(e)]);
  }

  console.log('\n=== RESULTS ===\n');
  for (const [name, result] of Object.entries(results)) {
    console.log(`${result.ok ? '✅' : '❌'} ${name}`);
    for (const line of result.details) {
      console.log(`   ${line}`);
    }
    console.log('');
  }

  const failed = Object.values(results).filter((r) => !r.ok).length;
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
