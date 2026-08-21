import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  DisputeStatus,
  MatchEaSyncStatus,
  MatchStatus,
  PaymentStatus,
  SeedingMode,
  TournamentFormat,
  TournamentStatus,
} from '@prisma/client';

import { MatchFallbackService } from '../fallback/match-fallback.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentCompletionService } from './tournament-completion.service';

interface ParticipantSlot {
  id: string;
  name: string;
  seed: number;
  rating: number;
}

@Injectable()
export class BracketService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TournamentCompletionService))
    private readonly tournamentCompletion: TournamentCompletionService,
    private readonly fallbackService: MatchFallbackService,
  ) {}

  async generateBracket(
    tournamentId: string,
    format: TournamentFormat,
    seedingMode: SeedingMode = SeedingMode.BY_RATING,
  ) {
    switch (format) {
      case TournamentFormat.SINGLE_ELIMINATION:
        return this.generateSingleElimination(tournamentId, seedingMode);
      case TournamentFormat.ROUND_ROBIN:
        return this.generateRoundRobin(tournamentId, seedingMode);
      case TournamentFormat.DOUBLE_ELIMINATION:
        throw new BadRequestException('Double Elimination будет добавлен в следующей версии');
      case TournamentFormat.SWISS:
        throw new BadRequestException('Swiss System будет добавлен в следующей версии');
      default:
        throw new BadRequestException('Неподдерживаемый формат турнира');
    }
  }

  async scheduleFirstRound(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return;

    const firstRound = await this.prisma.match.findMany({
      where: { tournamentId, round: 1 },
    });

    const now = new Date();
    const scheduledAt = tournament.startsAt > now ? tournament.startsAt : now;
    for (const match of firstRound) {
      const hasBoth =
        match.participant1Name &&
        match.participant2Name &&
        match.participant1Name !== 'TBD' &&
        match.participant2Name !== 'TBD' &&
        match.participant1Name !== 'BYE' &&
        match.participant2Name !== 'BYE';

      if (hasBoth && match.status === MatchStatus.PENDING) {
        await this.prisma.match.update({
          where: { id: match.id },
          data: {
            status: MatchStatus.SCHEDULED,
            scheduledAt,
            eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
          },
        });
        await this.fallbackService.scheduleFallbackCheck(match.id, scheduledAt);
      }
    }
  }

  private async generateSingleElimination(tournamentId: string, seedingMode: SeedingMode) {
    const participants = await this.loadAndSeedParticipants(tournamentId, seedingMode);

    if (participants.length < 2) {
      throw new BadRequestException('Минимум 2 оплативших участника для генерации сетки');
    }

    await this.prisma.match.deleteMany({ where: { tournamentId } });

    const bracketSize = nextPowerOf2(participants.length);
    const numRounds = Math.log2(bracketSize);

    const matchMap = new Map<string, string>();

    for (let round = numRounds; round >= 1; round--) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      for (let position = 0; position < matchesInRound; position++) {
        const nextMatchKey = round < numRounds ? `${round + 1}:${Math.floor(position / 2)}` : null;

        const match = await this.prisma.match.create({
          data: {
            tournamentId,
            round,
            position,
            nextMatchId: nextMatchKey ? matchMap.get(nextMatchKey) : null,
            participant1Name: 'TBD',
            participant2Name: 'TBD',
            status: MatchStatus.PENDING,
          },
        });

        matchMap.set(`${round}:${position}`, match.id);
      }
    }

    const seedOrder = getBracketSeedOrder(bracketSize);
    const slots: (ParticipantSlot | null)[] = seedOrder.map((seedNum) => {
      const p = participants.find((x) => x.seed === seedNum);
      return p ?? null;
    });

    const round1Matches = await this.prisma.match.findMany({
      where: { tournamentId, round: 1 },
      orderBy: { position: 'asc' },
    });

    for (let i = 0; i < round1Matches.length; i++) {
      const slot1 = slots[i * 2];
      const slot2 = slots[i * 2 + 1];
      await this.processFirstRoundMatch(round1Matches[i].id, slot1, slot2);
    }

    return this.prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });
  }

  private async generateRoundRobin(tournamentId: string, seedingMode: SeedingMode) {
    const participants = await this.loadAndSeedParticipants(tournamentId, seedingMode);

    if (participants.length < 2) {
      throw new BadRequestException('Минимум 2 оплативших участника для генерации сетки');
    }

    await this.prisma.match.deleteMany({ where: { tournamentId } });

    let position = 0;
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        await this.prisma.match.create({
          data: {
            tournamentId,
            round: 1,
            position: position++,
            participant1Id: participants[i].id,
            participant2Id: participants[j].id,
            participant1Name: participants[i].name,
            participant2Name: participants[j].name,
            status: MatchStatus.PENDING,
            eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
          },
        });
      }
    }

    return this.prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });
  }

  private async loadAndSeedParticipants(
    tournamentId: string,
    seedingMode: SeedingMode,
  ): Promise<ParticipantSlot[]> {
    const raw = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, paymentStatus: PaymentStatus.PAID },
      include: {
        user: { include: { profile: true, stats: true } },
        team: {
          include: {
            members: { include: { user: { include: { stats: true } } } },
          },
        },
      },
    });

    let sorted = raw.map((p) => {
      const teamRating =
        p.team?.members.reduce((sum, m) => sum + (m.user.stats?.rating ?? 1200), 0) ?? 0;
      const teamMemberCount = p.team?.members.length ?? 1;
      const rating = p.user?.stats?.rating ?? Math.round(teamRating / teamMemberCount);

      return {
        id: p.id,
        name: p.user?.profile?.nickname ?? p.team?.name ?? 'Unknown',
        rating,
        seed: p.seed,
      };
    });

    if (seedingMode === SeedingMode.RANDOM) {
      sorted = shuffle([...sorted]);
    } else {
      sorted.sort((a, b) => {
        if (a.seed && b.seed) return a.seed - b.seed;
        return b.rating - a.rating;
      });
    }

    for (let i = 0; i < sorted.length; i++) {
      const seed = i + 1;
      await this.prisma.tournamentParticipant.update({
        where: { id: sorted[i].id },
        data: { seed },
      });
      sorted[i].seed = seed;
    }

    return sorted.map((p) => ({
      id: p.id,
      name: p.name,
      seed: p.seed!,
      rating: p.rating,
    }));
  }

  private async processFirstRoundMatch(
    matchId: string,
    slot1: ParticipantSlot | null,
    slot2: ParticipantSlot | null,
  ) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return;

    if (!slot1 && !slot2) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.BYE, participant1Name: 'BYE', participant2Name: 'BYE' },
      });
      return;
    }

    if (!slot1 || !slot2) {
      const winner = slot1 ?? slot2!;
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          participant1Id: slot1?.id ?? null,
          participant2Id: slot2?.id ?? null,
          participant1Name: slot1?.name ?? 'BYE',
          participant2Name: slot2?.name ?? 'BYE',
          winnerId: winner.id,
          status: MatchStatus.COMPLETED,
          score1: slot1 ? 1 : 0,
          score2: slot2 ? 1 : 0,
        },
      });
      await this.advanceWinner(match, winner.id, winner.name);
      return;
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        participant1Id: slot1.id,
        participant2Id: slot2.id,
        participant1Name: slot1.name,
        participant2Name: slot2.name,
        status: MatchStatus.PENDING,
        eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
      },
    });
  }

  async advanceWinner(
    match: { id: string; nextMatchId: string | null; round: number; position: number },
    winnerId: string,
    winnerName: string,
  ) {
    if (!match.nextMatchId) return;

    const nextMatch = await this.prisma.match.findUnique({ where: { id: match.nextMatchId } });
    if (!nextMatch) return;

    const isTopSlot = match.position % 2 === 0;

    await this.prisma.match.update({
      where: { id: match.nextMatchId },
      data: isTopSlot
        ? { participant1Id: winnerId, participant1Name: winnerName }
        : { participant2Id: winnerId, participant2Name: winnerName },
    });
  }

  async finalizeMatch(matchId: string, score1: number, score2: number) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new BadRequestException('Матч не найден');

    if (score1 === score2) {
      throw new BadRequestException('Ничья не допускается в плей-офф');
    }

    await this.fallbackService.cancelFallbackCheck(matchId);

    const winnerIsP1 = score1 > score2;
    const winnerId = winnerIsP1 ? match.participant1Id : match.participant2Id;
    const winnerName = winnerIsP1 ? match.participant1Name : match.participant2Name;

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        winnerId,
        status: MatchStatus.COMPLETED,
        isActive: false,
        completedAt: new Date(),
        confirmationDeadline: null,
        fallbackDeadline: null,
        fallbackAutoAcceptDeadline: null,
      },
    });

    if (winnerId && winnerName) {
      await this.advanceWinner(match, winnerId, winnerName);

      const nextMatch = match.nextMatchId
        ? await this.prisma.match.findUnique({ where: { id: match.nextMatchId } })
        : null;

      if (
        nextMatch &&
        nextMatch.participant1Name &&
        nextMatch.participant2Name &&
        nextMatch.participant1Name !== 'TBD' &&
        nextMatch.participant2Name !== 'TBD' &&
        nextMatch.status === MatchStatus.PENDING
      ) {
        const nextScheduledAt = new Date();
        await this.prisma.match.update({
          where: { id: nextMatch.id },
          data: {
            status: MatchStatus.SCHEDULED,
            scheduledAt: nextScheduledAt,
            eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
          },
        });
        await this.fallbackService.scheduleFallbackCheck(nextMatch.id, nextScheduledAt);
      }
    }

    await this.checkTournamentCompletion(match.tournamentId);

    await this.prisma.match.updateMany({
      where: { tournamentId: match.tournamentId, isActive: true },
      data: { isActive: false },
    });

    return updated;
  }

  /** EA Sync — завершение матча со счётом из EA (поддержка ничьих в round robin). */
  async finalizeMatchFromEa(matchId: string, score1: number, score2: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new BadRequestException('Матч не найден');

    if (
      score1 === score2 &&
      match.tournament.format === TournamentFormat.ROUND_ROBIN &&
      match.round === 1
    ) {
      await this.fallbackService.cancelFallbackCheck(matchId);
      await this.fallbackService.cancelAutoAccept(matchId);

      const updated = await this.prisma.match.update({
        where: { id: matchId },
        data: {
          score1,
          score2,
          winnerId: null,
          status: MatchStatus.COMPLETED,
          isActive: false,
          completedAt: new Date(),
          confirmationDeadline: null,
          fallbackDeadline: null,
          fallbackAutoAcceptDeadline: null,
          eaSyncStatus: MatchEaSyncStatus.SYNCED,
        },
      });
      await this.checkTournamentCompletion(match.tournamentId);
      return updated;
    }

    const updated = await this.finalizeMatch(matchId, score1, score2);
    await this.prisma.match.update({
      where: { id: matchId },
      data: { eaSyncStatus: MatchEaSyncStatus.SYNCED },
    });
    return updated;
  }

  /** Organizer shortcut — bypasses dual confirmation */
  async updateMatchResult(matchId: string, score1: number, score2: number) {
    const updated = await this.finalizeMatch(matchId, score1, score2);
    await this.prisma.match.update({
      where: { id: matchId },
      data: { eaSyncStatus: MatchEaSyncStatus.MANUAL, eaSyncNote: 'Счёт введён организатором' },
    });
    return updated;
  }

  async processConfirmationTimeouts(tournamentId?: string) {
    const expired = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.AWAITING_CONFIRMATION,
        confirmationDeadline: { lt: new Date() },
        ...(tournamentId ? { tournamentId } : {}),
      },
      include: { submissions: true },
    });

    for (const match of expired) {
      // Fallback auto-accept is handled by the dedicated delayed job.
      if (match.fallbackAutoAcceptDeadline) continue;

      const reporterId = match.submissions[0]?.userId;
      if (!reporterId) continue;

      await this.openDispute(
        match.id,
        reporterId,
        'Истекло время ожидания подтверждения результата',
      );
    }
  }

  async openDispute(matchId: string, openedById: string, reasonText: string) {
    await this.fallbackService.cancelFallbackCheck(matchId);
    await this.fallbackService.cancelAutoAccept(matchId);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.DISPUTED,
        isActive: false,
        confirmationDeadline: null,
        fallbackAutoAcceptDeadline: null,
      },
    });

    await this.prisma.dispute.upsert({
      where: { matchId },
      create: {
        matchId,
        openedById,
        reasonText,
        status: DisputeStatus.OPEN,
      },
      update: {
        reasonText,
        status: DisputeStatus.OPEN,
        resolvedAt: null,
        resolvedById: null,
        resolutionNote: null,
      },
    });
  }

  private async checkTournamentCompletion(tournamentId: string) {
    const pending = await this.prisma.match.count({
      where: {
        tournamentId,
        status: {
          in: [
            MatchStatus.PENDING,
            MatchStatus.SCHEDULED,
            MatchStatus.IN_PROGRESS,
            MatchStatus.AWAITING_CONFIRMATION,
            MatchStatus.DISPUTED,
          ],
        },
        participant1Name: { notIn: ['TBD', 'BYE'] },
        participant2Name: { notIn: ['TBD', 'BYE'] },
      },
    });

    if (pending === 0) {
      const hasFinal = await this.prisma.match.findFirst({
        where: { tournamentId, status: MatchStatus.COMPLETED },
        orderBy: [{ round: 'desc' }, { position: 'asc' }],
      });
      if (hasFinal) {
        const tournament = await this.prisma.tournament.findUnique({
          where: { id: tournamentId },
        });
        if (tournament && tournament.status !== TournamentStatus.FINISHED) {
          await this.tournamentCompletion.onTournamentFinished(tournamentId);
        }
      }
    }
  }
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standard bracket seeding: 1 vs 8, 4 vs 5, etc. — strong seeds in different halves */
function getBracketSeedOrder(size: number): number[] {
  if (size <= 1) return [1];
  if (size === 2) return [1, 2];

  const half = getBracketSeedOrder(size / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed);
    result.push(size + 1 - seed);
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
