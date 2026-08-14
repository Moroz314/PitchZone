import { Injectable } from '@nestjs/common';
import { SeasonMatchStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeasonStandingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Пересчитывает таблицу для обеих команд после завершённого матча (идемпотентно). */
  async recalculateAfterMatch(seasonMatchId: string) {
    const match = await this.prisma.seasonMatch.findUnique({
      where: { id: seasonMatchId },
      select: {
        seasonId: true,
        homeTeamId: true,
        awayTeamId: true,
        status: true,
        homeScore: true,
        awayScore: true,
      },
    });

    if (!match || match.status !== SeasonMatchStatus.COMPLETED) return;
    if (match.homeScore === null || match.awayScore === null) return;

    await Promise.all([
      this.recalculateTeam(match.seasonId, match.homeTeamId),
      this.recalculateTeam(match.seasonId, match.awayTeamId),
    ]);
  }

  private async recalculateTeam(seasonId: string, teamId: string) {
    const entry = await this.prisma.seasonTeamEntry.findUnique({
      where: { seasonId_teamId: { seasonId, teamId } },
      select: { id: true },
    });
    if (!entry) return;

    const matches = await this.prisma.seasonMatch.findMany({
      where: {
        seasonId,
        status: SeasonMatchStatus.COMPLETED,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    });

    let points = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let matchesPlayed = 0;

    for (const m of matches) {
      if (m.homeScore === null || m.awayScore === null) continue;

      const isHome = m.homeTeamId === teamId;
      const scored = isHome ? m.homeScore : m.awayScore;
      const conceded = isHome ? m.awayScore : m.homeScore;

      matchesPlayed++;
      goalsFor += scored;
      goalsAgainst += conceded;

      if (scored > conceded) {
        points += 3;
        wins++;
      } else if (scored === conceded) {
        points += 1;
        draws++;
      } else {
        losses++;
      }
    }

    await this.prisma.seasonTeamEntry.update({
      where: { id: entry.id },
      data: { points, matchesPlayed, wins, draws, losses, goalsFor, goalsAgainst },
    });
  }
}
