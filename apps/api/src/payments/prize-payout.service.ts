import { Injectable, Logger } from '@nestjs/common';
import {
  EscrowStatus,
  MatchStatus,
  PaymentStatus,
  PrizePoolType,
  TournamentFormat,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from './escrow.service';

interface PrizePlace {
  place: number;
  percent: number;
}

@Injectable()
export class PrizePayoutService {
  private readonly logger = new Logger(PrizePayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
  ) {}

  async distribute(tournamentId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        escrow: true,
        participants: {
          where: { paymentStatus: PaymentStatus.PAID },
          include: {
            user: { include: { profile: true } },
            team: { include: { owner: true } },
          },
        },
        matches: { where: { status: MatchStatus.COMPLETED } },
      },
    });

    if (!tournament) return;

    if (tournament.escrow?.status === EscrowStatus.DISTRIBUTED) {
      return;
    }

    const placements = this.calculatePlacements(tournament.format, tournament.matches);

    for (const [participantId, place] of placements) {
      await this.prisma.tournamentParticipant.update({
        where: { id: participantId },
        data: { placement: place },
      });
    }

    const gross = this.resolveGrossPool(tournament);
    const commission = Math.floor(gross * (tournament.platformCommissionPercent / 100));
    const distributable = gross - commission;

    const distribution = (tournament.prizeDistribution as unknown as PrizePlace[]) ?? [
      { place: 1, percent: 100 },
    ];
    const payoutByParticipant = new Map<string, number>();

    for (const { place, percent } of distribution) {
      const atPlace = [...placements.entries()].filter(([, p]) => p === place);
      if (atPlace.length === 0) continue;

      const poolForPlace = Math.floor(distributable * (percent / 100));
      const perWinner = Math.floor(poolForPlace / atPlace.length);

      for (const [participantId] of atPlace) {
        payoutByParticipant.set(
          participantId,
          (payoutByParticipant.get(participantId) ?? 0) + perWinner,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (commission > 0) {
        await tx.transaction.create({
          data: {
            userId: tournament.organizerId,
            type: TransactionType.PLATFORM_COMMISSION,
            amount: commission,
            currency: tournament.currency,
            relatedTournamentId: tournamentId,
            status: TransactionStatus.COMPLETED,
          },
        });
      }

      for (const participant of tournament.participants) {
        const amount = payoutByParticipant.get(participant.id) ?? 0;

        await tx.tournamentParticipant.update({
          where: { id: participant.id },
          data: { prizeAmount: amount },
        });

        if (amount <= 0) continue;

        const payeeUserId = this.resolvePayeeUserId(participant);
        if (!payeeUserId) continue;

        const wallet = await tx.wallet.upsert({
          where: { userId: payeeUserId },
          create: { userId: payeeUserId, currency: tournament.currency },
          update: {},
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });

        await tx.transaction.create({
          data: {
            userId: payeeUserId,
            walletId: wallet.id,
            type: TransactionType.PRIZE_PAYOUT,
            amount,
            currency: tournament.currency,
            relatedTournamentId: tournamentId,
            relatedParticipantId: participant.id,
            status: TransactionStatus.COMPLETED,
          },
        });

        await tx.playerStats.upsert({
          where: { userId: payeeUserId },
          create: { userId: payeeUserId, totalEarnings: amount },
          update: { totalEarnings: { increment: amount } },
        });
      }

      if (tournament.escrow) {
        await tx.escrowAccount.update({
          where: { tournamentId },
          data: { status: EscrowStatus.DISTRIBUTED, totalHeld: 0 },
        });
      }
    });

    this.logger.log(
      `Distributed prizes for ${tournament.slug}: gross=${gross}, commission=${commission}, distributable=${distributable}`,
    );
  }

  private resolveGrossPool(tournament: {
    prizePoolType: PrizePoolType;
    fixedPrizePool: number | null;
    escrow: { totalHeld: number } | null;
  }): number {
    const held = tournament.escrow?.totalHeld ?? 0;
    if (tournament.prizePoolType === PrizePoolType.FIXED_SPONSORED) {
      return Math.max(held, tournament.fixedPrizePool ?? 0);
    }
    return held;
  }

  private resolvePayeeUserId(participant: {
    userId: string | null;
    team: { ownerId: string } | null;
  }): string | null {
    if (participant.userId) return participant.userId;
    return participant.team?.ownerId ?? null;
  }

  calculatePlacements(
    format: TournamentFormat,
    matches: {
      id: string;
      round: number;
      position: number;
      participant1Id: string | null;
      participant2Id: string | null;
      winnerId: string | null;
      status: MatchStatus;
    }[],
  ): Map<string, number> {
    if (format === TournamentFormat.ROUND_ROBIN) {
      return this.placementsFromRoundRobin(matches);
    }
    return this.placementsFromElimination(matches);
  }

  private placementsFromElimination(
    matches: {
      round: number;
      participant1Id: string | null;
      participant2Id: string | null;
      winnerId: string | null;
    }[],
  ): Map<string, number> {
    const placements = new Map<string, number>();
    if (matches.length === 0) return placements;

    const maxRound = Math.max(...matches.map((m) => m.round));
    const final = matches.find((m) => m.round === maxRound);

    if (final?.winnerId) {
      placements.set(final.winnerId, 1);
      const loserId =
        final.winnerId === final.participant1Id ? final.participant2Id : final.participant1Id;
      if (loserId) placements.set(loserId, 2);
    }

    const semiRound = maxRound - 1;
    if (semiRound >= 1) {
      const semis = matches.filter((m) => m.round === semiRound);
      let place = 3;
      for (const semi of semis) {
        if (!semi.winnerId) continue;
        const loserId =
          semi.winnerId === semi.participant1Id ? semi.participant2Id : semi.participant1Id;
        if (loserId && !placements.has(loserId)) {
          placements.set(loserId, place);
          place++;
        }
      }
    }

    const participantIds = new Set<string>();
    for (const m of matches) {
      if (m.participant1Id) participantIds.add(m.participant1Id);
      if (m.participant2Id) participantIds.add(m.participant2Id);
    }

    let nextPlace = placements.size > 0 ? Math.max(...placements.values()) + 1 : 1;
    for (const id of participantIds) {
      if (!placements.has(id)) {
        placements.set(id, nextPlace++);
      }
    }

    return placements;
  }

  private placementsFromRoundRobin(
    matches: {
      participant1Id: string | null;
      participant2Id: string | null;
      winnerId: string | null;
    }[],
  ): Map<string, number> {
    const wins = new Map<string, number>();

    for (const m of matches) {
      if (m.participant1Id) wins.set(m.participant1Id, wins.get(m.participant1Id) ?? 0);
      if (m.participant2Id) wins.set(m.participant2Id, wins.get(m.participant2Id) ?? 0);
      if (m.winnerId) {
        wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
      }
    }

    const sorted = [...wins.entries()].sort((a, b) => b[1] - a[1]);
    const placements = new Map<string, number>();
    let place = 1;

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][1] < sorted[i - 1][1]) {
        place = i + 1;
      }
      placements.set(sorted[i][0], place);
    }

    return placements;
  }
}
