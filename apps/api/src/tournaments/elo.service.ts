import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const K_FACTOR = 32;

@Injectable()
export class EloService {
  private readonly logger = new Logger(EloService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recalculateForTournament(tournamentId: string): Promise<void> {
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: {
        tournamentId,
        paymentStatus: PaymentStatus.PAID,
        placement: { not: null },
      },
      include: {
        user: { include: { stats: true } },
        team: {
          include: {
            members: { include: { user: { include: { stats: true } } } },
          },
        },
      },
    });

    if (participants.length < 2) return;

    const entries = participants.map((p) => ({
      participantId: p.id,
      placement: p.placement!,
      userIds: this.resolveUserIds(p),
      rating: this.averageRating(p),
    }));

    const n = entries.length;

    for (const entry of entries) {
      const actual = (n - entry.placement) / (n - 1);
      const opponents = entries.filter((e) => e.participantId !== entry.participantId);
      const avgOppRating =
        opponents.reduce((sum, o) => sum + o.rating, 0) / opponents.length;
      const expected = 1 / (1 + Math.pow(10, (avgOppRating - entry.rating) / 400));
      const delta = Math.round(K_FACTOR * (actual - expected));

      if (delta === 0) continue;

      for (const userId of entry.userIds) {
        const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
        const currentRating = stats?.rating ?? 1200;
        const newRating = Math.max(100, currentRating + delta);

        await this.prisma.playerStats.upsert({
          where: { userId },
          create: {
            userId,
            rating: newRating,
            wins: entry.placement === 1 ? 1 : 0,
            losses: entry.placement === 1 ? 0 : 1,
            tournamentsPlayed: 1,
          },
          update: {
            rating: newRating,
            wins: entry.placement === 1 ? { increment: 1 } : undefined,
            losses: entry.placement !== 1 ? { increment: 1 } : undefined,
            tournamentsPlayed: { increment: 1 },
          },
        });
      }
    }

    this.logger.log(`Elo recalculated for tournament ${tournamentId} (${n} participants)`);
  }

  private resolveUserIds(participant: {
    userId: string | null;
    team: { members: { userId: string }[] } | null;
  }): string[] {
    if (participant.userId) return [participant.userId];
    return participant.team?.members.map((m) => m.userId) ?? [];
  }

  private averageRating(participant: {
    user: { stats: { rating: number } | null } | null;
    team: { members: { user: { stats: { rating: number } | null } }[] } | null;
  }): number {
    if (participant.user) {
      return participant.user.stats?.rating ?? 1200;
    }

    const members = participant.team?.members ?? [];
    if (members.length === 0) return 1200;

    const total = members.reduce((sum, m) => sum + (m.user.stats?.rating ?? 1200), 0);
    return Math.round(total / members.length);
  }
}
