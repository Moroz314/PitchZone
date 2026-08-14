import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EaApiImportStatus, MatchEaSyncStatus, MatchStatus, PlayerPosition, SeasonMatchStatus } from '@prisma/client';

import { PlayerProfileAggregationService } from '../player-profile/player-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeasonStandingsService } from '../seasons/season-standings.service';
import { StatsService } from '../stats/stats.service';
import { TournamentStatsService } from '../stats/tournament-stats.service';
import { BracketService } from '../tournaments/bracket.service';
import { TournamentsGateway } from '../tournaments/tournaments.gateway';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EaClubLinkService } from './ea-club-link.service';
import { EaMatchMatcherService } from './ea-match-matcher.service';
import { mapEaPosition, passAccuracyPercent } from './ea-position.mapper';
import { EaProClubsStatsProvider } from './providers/ea-pro-clubs.provider';
import { EaClubMatchSummary } from './providers/stats-provider.interface';

export interface EaSyncRunResult {
  linksPolled: number;
  newMatches: number;
  imported: number;
  needsReview: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class EaSyncService {
  private readonly logger = new Logger(EaSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clubLinks: EaClubLinkService,
    private readonly matcher: EaMatchMatcherService,
    private readonly statsProvider: EaProClubsStatsProvider,
    private readonly statsService: StatsService,
    private readonly seasonStandings: SeasonStandingsService,
    private readonly tournamentStats: TournamentStatsService,
    private readonly playerProfile: PlayerProfileAggregationService,
    @Inject(forwardRef(() => BracketService))
    private readonly bracketService: BracketService,
    @Inject(forwardRef(() => TournamentsGateway))
    private readonly tournamentsGateway: TournamentsGateway,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
  ) {}

  async pollAllActiveClubs(): Promise<EaSyncRunResult> {
    const result: EaSyncRunResult = {
      linksPolled: 0,
      newMatches: 0,
      imported: 0,
      needsReview: 0,
      skipped: 0,
      errors: [],
    };

    const systemUserId = await this.resolveSystemUserId();
    const links = await this.clubLinks.listActiveLinks();
    result.linksPolled = links.length;

    for (const link of links) {
      try {
        await this.pollClubLink(link.id, link.teamId, link.eaClubId, link.platform, systemUserId, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${link.team.tag}: ${msg}`);
        this.logger.error(`Poll failed for team ${link.teamId}: ${msg}`);
      }
    }

    return result;
  }

  async pollSingleClub(teamId: string): Promise<EaSyncRunResult> {
    const link = await this.prisma.eaClubLink.findUnique({
      where: { teamId },
      include: { team: { select: { tag: true } } },
    });
    if (!link) throw new Error('EA Club Link не настроен');

    const result: EaSyncRunResult = {
      linksPolled: 1,
      newMatches: 0,
      imported: 0,
      needsReview: 0,
      skipped: 0,
      errors: [],
    };

    const systemUserId = await this.resolveSystemUserId();
    await this.pollClubLink(
      link.id,
      link.teamId,
      link.eaClubId,
      link.platform,
      systemUserId,
      result,
    );

    return result;
  }

  async listImports(limit = 50) {
    return this.prisma.eaApiMatchImport.findMany({
      orderBy: { importedAt: 'desc' },
      take: limit,
      include: {
        eaClubLink: { include: { team: { select: { tag: true, name: true, id: true } } } },
        matchedSeasonMatch: {
          select: {
            id: true,
            homeTeam: { select: { tag: true } },
            awayTeam: { select: { tag: true } },
          },
        },
        matchedTournamentMatch: {
          select: {
            id: true,
            participant1Name: true,
            participant2Name: true,
            tournament: { select: { slug: true, title: true } },
          },
        },
      },
    });
  }

  async markStaleAwaitingEaMatches(timeoutMinutes = 60) {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const result = await this.prisma.match.updateMany({
      where: {
        eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS] },
        scheduledAt: { lt: cutoff },
      },
      data: {
        eaSyncStatus: MatchEaSyncStatus.NEEDS_REVIEW,
        eaSyncNote: `EA не вернул результат за ${timeoutMinutes} мин — введите счёт вручную`,
      },
    });
    return result.count;
  }

  async getDashboardStatus() {
    const [links, importCounts, latestImport] = await Promise.all([
      this.prisma.eaClubLink.findMany({
        include: { team: { select: { id: true, name: true, tag: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.eaApiMatchImport.groupBy({
        by: ['importStatus'],
        _count: { id: true },
      }),
      this.prisma.eaApiMatchImport.findFirst({
        orderBy: { importedAt: 'desc' },
        select: { importedAt: true },
      }),
    ]);

    const counts = Object.fromEntries(
      importCounts.map((c) => [c.importStatus, c._count.id]),
    ) as Record<string, number>;

    const lastPolled = links.reduce<Date | null>((max, link) => {
      if (!link.lastPolledAt) return max;
      return !max || link.lastPolledAt > max ? link.lastPolledAt : max;
    }, null);

    return {
      linkedClubsCount: links.length,
      lastPolledAt: lastPolled?.toISOString() ?? null,
      lastImportAt: latestImport?.importedAt.toISOString() ?? null,
      importCounts: {
        imported: counts.IMPORTED ?? 0,
        needsReview: counts.NEEDS_REVIEW ?? 0,
        discarded: counts.DISCARDED ?? 0,
      },
      workerNote:
        'Фоновый воркер (npm run start:worker) опрашивает EA каждые ~20 мин. Кнопка «Опросить сейчас» работает без воркера.',
      links: links.map((l) => ({
        teamId: l.teamId,
        teamTag: l.team.tag,
        teamName: l.team.name,
        eaClubId: l.eaClubId,
        platform: l.platform,
        lastPolledAt: l.lastPolledAt?.toISOString() ?? null,
        lastSyncedMatchEaId: l.lastSyncedMatchEaId,
      })),
    };
  }

  private async pollClubLink(
    linkId: string,
    teamId: string,
    eaClubId: string,
    platform: import('@prisma/client').EaClubPlatform,
    systemUserId: string,
    result: EaSyncRunResult,
  ) {
    const matches = await this.statsProvider.fetchClubMatches(eaClubId, platform);

    await this.prisma.eaClubLink.update({
      where: { id: linkId },
      data: { lastPolledAt: new Date() },
    });

    const knownImports = await this.prisma.eaApiMatchImport.findMany({
      where: { eaClubLinkId: linkId },
      select: { eaMatchId: true },
    });
    const knownIds = new Set(knownImports.map((i) => i.eaMatchId));

    for (const eaMatch of matches) {
      if (knownIds.has(eaMatch.matchId)) {
        result.skipped++;
        continue;
      }

      result.newMatches++;
      await this.processEaMatch(linkId, teamId, eaClubId, platform, eaMatch, systemUserId, result);
    }
  }

  private async processEaMatch(
    linkId: string,
    teamId: string,
    eaClubId: string,
    platform: import('@prisma/client').EaClubPlatform,
    eaMatch: EaClubMatchSummary,
    systemUserId: string,
    result: EaSyncRunResult,
  ) {
    const opponentEaClubId = this.matcher.resolveOpponentEaClubId(eaClubId, eaMatch);
    const linkResult = await this.matcher.findInternalMatch(teamId, eaMatch, opponentEaClubId);

    const importRecord = await this.prisma.eaApiMatchImport.create({
      data: {
        eaMatchId: eaMatch.matchId,
        eaClubLinkId: linkId,
        rawJson: eaMatch.raw as object,
        importStatus: EaApiImportStatus.NEEDS_REVIEW,
        reviewNote:
          linkResult.status === 'MATCHED'
            ? null
            : linkResult.status === 'NEEDS_REVIEW'
              ? linkResult.reason
              : linkResult.reason,
        matchedSeasonMatchId:
          linkResult.status === 'MATCHED' && linkResult.kind === 'season'
            ? linkResult.matchId
            : null,
        matchedTournamentMatchId:
          linkResult.status === 'MATCHED' && linkResult.kind === 'tournament'
            ? linkResult.matchId
            : null,
      },
    });

    if (linkResult.status !== 'MATCHED') {
      result.needsReview++;
      return;
    }

    if (linkResult.kind === 'season') {
      await this.processSeasonEaMatch(
        linkId,
        linkResult.matchId,
        eaMatch,
        importRecord.id,
        systemUserId,
        result,
      );
      return;
    }

    await this.processTournamentEaMatch(
      linkId,
      teamId,
      linkResult.matchId,
      eaMatch,
      importRecord.id,
      systemUserId,
      result,
    );
  }

  private async processSeasonEaMatch(
    linkId: string,
    seasonMatchId: string,
    eaMatch: EaClubMatchSummary,
    importRecordId: string,
    systemUserId: string,
    result: EaSyncRunResult,
  ) {
    const seasonMatch = await this.prisma.seasonMatch.findUnique({
      where: { id: seasonMatchId },
      select: { id: true, eaMatchId: true, homeTeamId: true, awayTeamId: true },
    });
    if (!seasonMatch) {
      result.needsReview++;
      return;
    }

    if (seasonMatch.eaMatchId === eaMatch.matchId) {
      await this.prisma.eaApiMatchImport.update({
        where: { id: importRecordId },
        data: { importStatus: EaApiImportStatus.IMPORTED, reviewNote: 'Уже импортирован ранее' },
      });
      result.skipped++;
      return;
    }

    const createdStats = await this.importPlayerStatsForTeams(
      seasonMatch.homeTeamId,
      seasonMatch.awayTeamId,
      eaMatch,
      (players) =>
        this.statsService.importEaPlayerStatsSkipExisting(seasonMatchId, systemUserId, players),
    );

    if (createdStats.length === 0) {
      await this.prisma.eaApiMatchImport.update({
        where: { id: importRecordId },
        data: {
          importStatus: EaApiImportStatus.NEEDS_REVIEW,
          reviewNote: 'Не удалось сопоставить игроков EA с геймертегами PitchZone',
        },
      });
      result.needsReview++;
      return;
    }

    const [homeLink, awayLink] = await Promise.all([
      this.prisma.eaClubLink.findUnique({ where: { teamId: seasonMatch.homeTeamId } }),
      this.prisma.eaClubLink.findUnique({ where: { teamId: seasonMatch.awayTeamId } }),
    ]);
    const scores = this.resolveScoresForTeams(
      seasonMatch.homeTeamId,
      seasonMatch.awayTeamId,
      homeLink,
      awayLink,
      eaMatch,
    );

    await this.prisma.$transaction([
      this.prisma.seasonMatch.update({
        where: { id: seasonMatchId },
        data: {
          eaMatchId: eaMatch.matchId,
          homeScore: scores.homeScore,
          awayScore: scores.awayScore,
          status: SeasonMatchStatus.COMPLETED,
          playedAt: eaMatch.timestamp,
        },
      }),
      this.prisma.eaApiMatchImport.update({
        where: { id: importRecordId },
        data: { importStatus: EaApiImportStatus.IMPORTED },
      }),
      this.prisma.eaClubLink.update({
        where: { id: linkId },
        data: { lastSyncedMatchEaId: eaMatch.matchId },
      }),
    ]);

    await this.seasonStandings.recalculateAfterMatch(seasonMatchId);
    result.imported++;
  }

  private async processTournamentEaMatch(
    linkId: string,
    linkTeamId: string,
    tournamentMatchId: string,
    eaMatch: EaClubMatchSummary,
    importRecordId: string,
    systemUserId: string,
    result: EaSyncRunResult,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: tournamentMatchId },
      include: {
        tournament: { select: { id: true, slug: true, format: true } },
        submissions: false,
      },
    });
    if (!match?.participant1Id || !match.participant2Id) {
      result.needsReview++;
      return;
    }

    if (match.eaMatchId === eaMatch.matchId) {
      await this.prisma.eaApiMatchImport.update({
        where: { id: importRecordId },
        data: { importStatus: EaApiImportStatus.IMPORTED, reviewNote: 'Уже импортирован ранее' },
      });
      result.skipped++;
      return;
    }

    const [p1, p2] = await Promise.all([
      this.prisma.tournamentParticipant.findUnique({
        where: { id: match.participant1Id },
        select: { teamId: true },
      }),
      this.prisma.tournamentParticipant.findUnique({
        where: { id: match.participant2Id },
        select: { teamId: true },
      }),
    ]);

    if (!p1?.teamId || !p2?.teamId) {
      result.needsReview++;
      return;
    }

    const createdStats = await this.importPlayerStatsForTeams(
      p1.teamId,
      p2.teamId,
      eaMatch,
      (players) =>
        this.statsService.importEaTournamentPlayerStatsSkipExisting(
          tournamentMatchId,
          systemUserId,
          players,
        ),
    );

    if (createdStats.length === 0) {
      await this.prisma.eaApiMatchImport.update({
        where: { id: importRecordId },
        data: {
          importStatus: EaApiImportStatus.NEEDS_REVIEW,
          reviewNote: 'Не удалось сопоставить игроков EA с геймертегами PitchZone',
        },
      });
      result.needsReview++;
      return;
    }

    const [homeLink, awayLink] = await Promise.all([
      this.prisma.eaClubLink.findUnique({ where: { teamId: p1.teamId } }),
      this.prisma.eaClubLink.findUnique({ where: { teamId: p2.teamId } }),
    ]);
    const scores = this.resolveScoresForTeams(p1.teamId, p2.teamId, homeLink, awayLink, eaMatch);

    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: tournamentMatchId },
        data: {
          eaMatchId: eaMatch.matchId,
          eaSyncStatus: MatchEaSyncStatus.SYNCED,
          eaSyncNote: null,
        },
      }),
      this.prisma.eaApiMatchImport.update({
        where: { id: importRecordId },
        data: { importStatus: EaApiImportStatus.IMPORTED },
      }),
      this.prisma.eaClubLink.update({
        where: { id: linkId },
        data: { lastSyncedMatchEaId: eaMatch.matchId },
      }),
    ]);

    await this.bracketService.finalizeMatchFromEa(tournamentMatchId, scores.homeScore, scores.awayScore);

    const userIds = [...new Set(createdStats.map((s) => s.userId))];
    await this.tournamentStats.recalculateAfterTournamentMatchImport(
      match.tournamentId,
      userIds,
      [p1.teamId, p2.teamId],
    );

    for (const userId of userIds) {
      await this.playerProfile.recalculateCareerStats(userId);
    }

    await this.tournamentStats.maybeGenerateFinalFromRoundRobin(match.tournamentId);

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: match.tournamentId },
      include: { matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] } },
    });
    if (tournament) {
      this.tournamentsGateway.emitBracketUpdate(tournament.slug, {
        tournament: { id: tournament.id, slug: tournament.slug, title: tournament.title },
        matches: tournament.matches.map((m) => this.tournamentsService.formatMatch(m)),
      });
    }

    result.imported++;
  }

  private async importPlayerStatsForTeams(
    teamAId: string,
    teamBId: string,
    eaMatch: EaClubMatchSummary,
    importFn: (players: Awaited<ReturnType<EaSyncService['mapEaPlayersToEntries']>>) => Promise<{ userId: string }[]>,
  ) {
    const raw = eaMatch.raw as Parameters<EaProClubsStatsProvider['parsePlayersFromRaw']>[0];
    const allCreated: { userId: string }[] = [];

    for (const teamId of [teamAId, teamBId]) {
      const link = await this.prisma.eaClubLink.findUnique({ where: { teamId } });
      if (!link) continue;
      const eaPlayers = this.statsProvider.parsePlayersFromRaw(raw, link.eaClubId);
      const mapped = await this.mapEaPlayersToEntries(eaPlayers, teamId);
      if (mapped.length === 0) continue;
      const created = await importFn(mapped);
      allCreated.push(...created);
    }

    return allCreated;
  }

  private resolveScoresForTeams(
    teamAId: string,
    teamBId: string,
    linkA: { eaClubId: string } | null,
    linkB: { eaClubId: string } | null,
    eaMatch: EaClubMatchSummary,
  ): { homeScore: number; awayScore: number } {
    const raw = eaMatch.raw as {
      clubs?: Record<string, { goals?: string; details?: { clubId?: number } }>;
    };
    const scores = new Map<string, number>();
    for (const [key, club] of Object.entries(raw.clubs ?? {})) {
      const id = String(club.details?.clubId ?? key);
      scores.set(id, Number(club.goals ?? 0));
    }

    const homeEaId = linkA?.eaClubId;
    const awayEaId = linkB?.eaClubId;
    if (homeEaId && awayEaId && scores.has(homeEaId) && scores.has(awayEaId)) {
      return { homeScore: scores.get(homeEaId)!, awayScore: scores.get(awayEaId)! };
    }

    return { homeScore: eaMatch.homeScore, awayScore: eaMatch.awayScore };
  }

  /** @deprecated use resolveScoresForTeams */
  private resolveScoresForSeasonMatch(
    seasonMatch: { homeTeamId: string; awayTeamId: string },
    homeLink: { eaClubId: string } | null,
    awayLink: { eaClubId: string } | null,
    eaMatch: EaClubMatchSummary,
  ): { homeScore: number; awayScore: number } {
    return this.resolveScoresForTeams(
      seasonMatch.homeTeamId,
      seasonMatch.awayTeamId,
      homeLink,
      awayLink,
      eaMatch,
    );
  }

  private async mapEaPlayersToEntries(
    eaPlayers: import('./providers/stats-provider.interface').EaPlayerMatchStat[],
    teamId: string,
  ) {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { include: { profile: true } } },
    });

    const byGamerTag = new Map<string, string>();
    for (const m of members) {
      const tag = m.user.profile?.gamerTag?.trim().toLowerCase();
      if (tag) byGamerTag.set(tag, m.userId);
    }

    const entries: {
      userId: string;
      positionPlayed: PlayerPosition;
      passAccuracy: number;
      dribbles: number;
      tacklesWon: number;
      goals: number;
      assists: number;
      saves?: number;
      interceptions?: number;
      fouls?: number;
      cleanSheet?: boolean;
      otherMetrics?: Record<string, unknown>;
    }[] = [];

    for (const p of eaPlayers) {
      const userId = byGamerTag.get(p.playerName.toLowerCase());
      if (!userId) continue;

      entries.push({
        userId,
        positionPlayed: mapEaPosition(p.positionCode),
        passAccuracy: passAccuracyPercent(p.passesMade, p.passAttempts),
        dribbles: 0,
        tacklesWon: p.tacklesMade,
        goals: p.goals,
        assists: p.assists,
        saves: p.saves,
        interceptions: p.interceptions,
        fouls: p.fouls,
        cleanSheet: p.cleanSheet,
        otherMetrics: p.eaMetrics,
      });
    }

    return entries;
  }

  private async resolveSystemUserId() {
    const mod = await this.prisma.user.findFirst({
      where: { role: { in: ['MODERATOR', 'ADMIN'] }, isStatTracker: true },
      select: { id: true },
    });
    if (mod) return mod.id;

    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin) throw new Error('Нет системного пользователя для импорта EA');
    return admin.id;
  }
}
