import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { MatchStatus, TeamRole } from '@prisma/client';
import IORedis from 'ioredis';

import { MatchFallbackService, MATCH_FALLBACK_QUEUE } from '../fallback/match-fallback.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BracketService } from '../tournaments/bracket.service';
import { TournamentsGateway } from '../tournaments/tournaments.gateway';

@Injectable()
export class MatchFallbackProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchFallbackProcessor.name);
  private connection!: IORedis;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly fallbackService: MatchFallbackService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly bracketService: BracketService,
    private readonly tournamentsGateway: TournamentsGateway,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.worker = new Worker(
      MATCH_FALLBACK_QUEUE,
      async (job: Job) => {
        if (job.name === 'fallback-check') {
          return this.handleFallbackCheck(job.data.matchId as string);
        }
        if (job.name === 'fallback-confirmation') {
          return this.handleAutoAccept(job.data.matchId as string);
        }
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Fallback job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Match fallback processor started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }

  private async handleFallbackCheck(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        submissions: true,
      },
    });

    if (!match) {
      this.logger.warn(`Fallback check for unknown match ${matchId}`);
      return;
    }

    if (
      match.status === MatchStatus.COMPLETED ||
      match.status === MatchStatus.CANCELLED ||
      match.status === MatchStatus.BYE
    ) {
      return;
    }

    if (match.submissions.length >= 1) {
      if (match.fallbackAutoAcceptDeadline) {
        return;
      }
      const sub = match.submissions[0]!;
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          fallbackAutoAcceptDeadline: new Date(
            Date.now() + this.fallbackService.confirmationTimeoutMs,
          ),
          status: MatchStatus.AWAITING_CONFIRMATION,
        },
      });
      await this.fallbackService.scheduleAutoAccept(matchId, sub.submittedAt);
      return;
    }

    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.IN_PROGRESS) {
      return;
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        fallbackDeadline: new Date(),
        status: MatchStatus.IN_PROGRESS,
      },
    });

    const captains = await this.resolveCaptainUserIds(match);
    const link = `/tournaments/${match.tournament.slug}`;
    const title = 'EA не прислала результат матча';
    const message =
      'Автоматическая синхронизация с EA не нашла результат матча. Внесите счёт и отчёт вручную, иначе результат может быть засчитан автоматически по истечении таймаута.';

    for (const userId of captains) {
      await this.notifications.create(userId, {
        type: 'MATCH_FALLBACK',
        title,
        message,
        link,
      });
    }

    await this.emitMatchUpdate(match);
  }

  private async handleAutoAccept(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        submissions: true,
        dispute: true,
      },
    });

    if (!match) return;

    if (
      match.status === MatchStatus.COMPLETED ||
      match.status === MatchStatus.DISPUTED ||
      match.status === MatchStatus.CANCELLED ||
      match.status === MatchStatus.BYE
    ) {
      return;
    }

    if (match.submissions.length === 1 && !match.dispute) {
      const sub = match.submissions[0]!;
      await this.fallbackService.cancelFallbackCheck(matchId);
      await this.prisma.match.update({
        where: { id: matchId },
        data: { fallbackAutoAcceptDeadline: null },
      });
      await this.bracketService.finalizeMatch(matchId, sub.score1, sub.score2);
      await this.emitMatchUpdate(match);
      this.logger.log(
        `Auto-accepted single submission for match ${matchId}: ${sub.score1}:${sub.score2}`,
      );
      return;
    }

    if (match.submissions.length === 0 && match.fallbackDeadline) {
      this.logger.warn(`No submissions for match ${matchId} after fallback confirmation window`);
    }
  }

  private async resolveCaptainUserIds(match: {
    participant1Id: string | null;
    participant2Id: string | null;
  }) {
    const ids = [match.participant1Id, match.participant2Id].filter((id): id is string => !!id);
    if (!ids.length) return [];

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { id: { in: ids } },
      include: {
        user: true,
        team: {
          include: { members: { select: { userId: true, role: true } } },
        },
      },
    });

    const userIds = new Set<string>();

    for (const p of participants) {
      if (p.userId) {
        userIds.add(p.userId);
        continue;
      }
      if (p.team) {
        const captains = p.team.members
          .filter((m) => m.role === TeamRole.CAPTAIN)
          .map((m) => m.userId);
        if (captains.length) {
          captains.forEach((id) => userIds.add(id));
        } else {
          const owners = p.team.members
            .filter((m) => m.role === TeamRole.OWNER)
            .map((m) => m.userId);
          if (owners.length) {
            owners.forEach((id) => userIds.add(id));
          } else if (p.team.ownerId) {
            userIds.add(p.team.ownerId);
          }
        }
      }
    }

    return [...userIds];
  }

  private async emitMatchUpdate(match: { id: string; tournamentId: string }) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: match.tournamentId },
      include: { matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] } },
    });
    if (!tournament) return;

    this.tournamentsGateway.emitBracketUpdate(tournament.slug, {
      tournament,
      matches: tournament.matches,
    });
  }
}
