import { Injectable } from '@nestjs/common';
import { MatchStatus, SeasonMatchStatus, SeasonStatus, TournamentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EaClubMatchSummary } from './providers/stats-provider.interface';

const MATCH_TIME_WINDOW_MS = 4 * 60 * 60 * 1000;

export type InternalMatchLinkResult =
  | { status: 'MATCHED'; kind: 'season'; matchId: string }
  | { status: 'MATCHED'; kind: 'tournament'; matchId: string }
  | { status: 'NEEDS_REVIEW'; reason: string; candidateIds: string[] }
  | { status: 'NO_CANDIDATE'; reason: string };

@Injectable()
export class EaMatchMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async findInternalMatch(
    linkTeamId: string,
    eaMatch: EaClubMatchSummary,
    opponentEaClubId: string,
  ): Promise<InternalMatchLinkResult> {
    const opponentLinks = await this.prisma.eaClubLink.findMany({
      where: { eaClubId: opponentEaClubId },
    });

    if (opponentLinks.length === 0) {
      return {
        status: 'NEEDS_REVIEW',
        reason: `Соперник EA club ${opponentEaClubId} не привязан на платформе`,
        candidateIds: [],
      };
    }

    for (const opponentLink of opponentLinks) {
      const seasonResult = await this.findSeasonMatchForPair(
        linkTeamId,
        opponentLink.teamId,
        eaMatch,
      );
      if (seasonResult.status === 'MATCHED') return seasonResult;
      if (seasonResult.status === 'NEEDS_REVIEW') return seasonResult;

      const tournamentResult = await this.findTournamentMatchForPair(
        linkTeamId,
        opponentLink.teamId,
        eaMatch,
      );
      if (tournamentResult.status === 'MATCHED') return tournamentResult;
      if (tournamentResult.status === 'NEEDS_REVIEW') return tournamentResult;
    }

    return {
      status: 'NO_CANDIDATE',
      reason: 'Нет SeasonMatch или Tournament Match в окне ±4ч по паре клубов',
    };
  }

  resolveOpponentEaClubId(linkEaClubId: string, eaMatch: EaClubMatchSummary): string {
    if (eaMatch.homeEaClubId === linkEaClubId) return eaMatch.awayEaClubId;
    if (eaMatch.awayEaClubId === linkEaClubId) return eaMatch.homeEaClubId;
    return eaMatch.awayEaClubId;
  }

  private async findSeasonMatchForPair(
    linkTeamId: string,
    opponentTeamId: string,
    eaMatch: EaClubMatchSummary,
  ): Promise<InternalMatchLinkResult> {
    const activeSeasons = await this.prisma.season.findMany({
      where: { status: { in: [SeasonStatus.ACTIVE, SeasonStatus.REGISTRATION] } },
      select: { id: true },
    });
    const seasonIds = activeSeasons.map((s) => s.id);
    if (seasonIds.length === 0) {
      return { status: 'NO_CANDIDATE', reason: 'Нет активных сезонов' };
    }

    const windowStart = new Date(eaMatch.timestamp.getTime() - MATCH_TIME_WINDOW_MS);
    const windowEnd = new Date(eaMatch.timestamp.getTime() + MATCH_TIME_WINDOW_MS);

    const candidates = await this.prisma.seasonMatch.findMany({
      where: {
        seasonId: { in: seasonIds },
        OR: [
          { homeTeamId: linkTeamId, awayTeamId: opponentTeamId },
          { homeTeamId: opponentTeamId, awayTeamId: linkTeamId },
        ],
        AND: [
          {
            OR: [
              { playedAt: { gte: windowStart, lte: windowEnd } },
              { playedAt: null, createdAt: { gte: windowStart, lte: windowEnd } },
            ],
          },
          { eaMatchId: null },
          { status: { in: [SeasonMatchStatus.SCHEDULED, SeasonMatchStatus.COMPLETED] } },
        ],
      },
    });

    if (candidates.length === 0) {
      return { status: 'NO_CANDIDATE', reason: 'Нет SeasonMatch в окне ±4ч' };
    }
    if (candidates.length > 1) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'Несколько сезонных матчей в окне времени',
        candidateIds: candidates.map((c) => c.id),
      };
    }

    return { status: 'MATCHED', kind: 'season', matchId: candidates[0].id };
  }

  private async findTournamentMatchForPair(
    linkTeamId: string,
    opponentTeamId: string,
    eaMatch: EaClubMatchSummary,
  ): Promise<InternalMatchLinkResult> {
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { teamId: { in: [linkTeamId, opponentTeamId] } },
      select: { id: true, teamId: true, tournamentId: true },
    });

    const linkParticipants = participants.filter((p) => p.teamId === linkTeamId);
    const oppParticipants = participants.filter((p) => p.teamId === opponentTeamId);
    if (linkParticipants.length === 0 || oppParticipants.length === 0) {
      return { status: 'NO_CANDIDATE', reason: 'Команды не зарегистрированы в турнирах' };
    }

    const linkIds = linkParticipants.map((p) => p.id);
    const oppIds = oppParticipants.map((p) => p.id);
    const tournamentIds = [...new Set(linkParticipants.map((p) => p.tournamentId))].filter((tid) =>
      oppParticipants.some((p) => p.tournamentId === tid),
    );

    if (tournamentIds.length === 0) {
      return { status: 'NO_CANDIDATE', reason: 'Нет общего турнира для пары команд' };
    }

    const windowStart = new Date(eaMatch.timestamp.getTime() - MATCH_TIME_WINDOW_MS);
    const windowEnd = new Date(eaMatch.timestamp.getTime() + MATCH_TIME_WINDOW_MS);

    const candidates = await this.prisma.match.findMany({
      where: {
        tournamentId: { in: tournamentIds },
        OR: [
          { participant1Id: { in: linkIds }, participant2Id: { in: oppIds } },
          { participant1Id: { in: oppIds }, participant2Id: { in: linkIds } },
        ],
        eaMatchId: null,
        status: {
          in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS, MatchStatus.PENDING],
        },
        tournament: {
          status: {
            in: [
              TournamentStatus.LIVE,
              TournamentStatus.BRACKET_GENERATED,
              TournamentStatus.REGISTRATION_CLOSED,
            ],
          },
        },
        AND: [
          {
            OR: [
              { scheduledAt: { gte: windowStart, lte: windowEnd } },
              { scheduledAt: null, createdAt: { gte: windowStart, lte: windowEnd } },
            ],
          },
        ],
      },
    });

    if (candidates.length === 0) {
      return { status: 'NO_CANDIDATE', reason: 'Нет турнирного матча в окне ±4ч' };
    }
    if (candidates.length > 1) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'Несколько турнирных матчей в окне времени',
        candidateIds: candidates.map((c) => c.id),
      };
    }

    return { status: 'MATCHED', kind: 'tournament', matchId: candidates[0].id };
  }
}
