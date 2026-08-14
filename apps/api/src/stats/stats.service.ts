import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DivisionTier, PlayerPosition, Prisma, SeasonMatchStatus, SeasonStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { parseEaClubPlayersFromMatchRaw } from '../ea-sync/ea-player-stats.mapper';
import { POSITION_LABELS } from '../clubs/constants/club-colors';
import { SeasonStandingsService } from '../seasons/season-standings.service';
import {
  CompleteSeasonMatchDto,
  CreateSeasonMatchDto,
  PlayerStatEntryDto,
  TotsSelectionDto,
  TotwSelectionDto,
} from './dto/stats.dto';
import { XpCalculatorService } from './xp-calculator.service';

const MIN_MATCHES_FOR_RECALC = 10;
const MAX_RATING_DELTA = 5;
const INELIGIBLE_PENALTY = 2;
const CARD_RATING_MIN = 65;
const CARD_RATING_MAX = 99;

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xpCalculator: XpCalculatorService,
    private readonly seasonStandings: SeasonStandingsService,
  ) {}

  async getPlayerMatchStats(userId: string, limit = 50) {
    const stats = await this.prisma.playerMatchStat.findMany({
      where: { userId, seasonMatchId: { not: null } },
      include: {
        seasonMatch: {
          include: {
            season: { select: { id: true, name: true } },
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
            division: { select: { name: true } },
          },
        },
      },
      orderBy: { enteredAt: 'desc' },
      take: limit,
    });

    return stats
      .filter(
        (s): s is (typeof stats)[number] & {
          seasonMatch: NonNullable<(typeof stats)[number]['seasonMatch']>;
        } => s.seasonMatch != null,
      )
      .map((s) => this.formatPlayerMatchStat(s));
  }

  async getPlayerCardProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, stats: true },
    });
    if (!user?.profile) throw new NotFoundException('Игрок не найден');

    const latestHistory = await this.prisma.playerRatingHistory.findFirst({
      where: { userId },
      orderBy: { calculatedAt: 'desc' },
      include: { season: { select: { name: true } } },
    });

    const currentSeason = await this.prisma.season.findFirst({
      where: { status: { in: [SeasonStatus.ACTIVE, SeasonStatus.REGISTRATION] } },
      orderBy: { startDate: 'desc' },
    });

    const seasonXp = currentSeason
      ? await this.prisma.seasonXpSummary.findUnique({
          where: { seasonId_userId: { seasonId: currentSeason.id, userId } },
        })
      : null;

    return {
      userId,
      nickname: user.profile.nickname,
      cardRating: user.stats?.cardRating ?? 75,
      eloRating: user.stats?.rating ?? 1200,
      totwCount: user.stats?.totwCount ?? 0,
      currentSeasonXp: seasonXp?.totalXp ?? 0,
      currentSeasonMatches: seasonXp?.matchesPlayed ?? 0,
      lastSeasonRecalc: latestHistory
        ? {
            seasonName: latestHistory.season.name,
            baseRating: latestHistory.baseRating,
            totwBonus: latestHistory.totwBonus,
            totsBonus: latestHistory.totsBonus,
            finalRating: latestHistory.finalRating,
            calculatedAt: latestHistory.calculatedAt.toISOString(),
          }
        : null,
    };
  }

  async getSeasonXpLeaderboard(seasonId: string, limit = 50) {
    const summaries = await this.prisma.seasonXpSummary.findMany({
      where: { seasonId },
      orderBy: { totalXp: 'desc' },
      take: limit,
      include: {
        user: { include: { profile: true, stats: true } },
      },
    });

    return summaries.map((s, index) => ({
      rank: s.rankInSeason ?? index + 1,
      userId: s.userId,
      nickname: s.user.profile?.nickname,
      avatar: s.user.profile?.avatar,
      cardRating: s.user.stats?.cardRating ?? 75,
      totalXp: s.totalXp,
      matchesPlayed: s.matchesPlayed,
      eligibleForRecalculation: s.eligibleForRecalculation,
    }));
  }

  async getTotw(seasonId: string, weekNumber: number) {
    const selections = await this.prisma.teamOfTheWeek.findMany({
      where: { seasonId, weekNumber },
      include: { player: { include: { profile: true, stats: true } } },
      orderBy: { positionSlot: 'asc' },
    });

    return selections.map((s) => ({
      position: s.positionSlot,
      positionLabel: POSITION_LABELS[s.positionSlot],
      userId: s.userId,
      nickname: s.player.profile?.nickname,
      avatar: s.player.profile?.avatar,
      cardRating: s.player.stats?.cardRating ?? 75,
    }));
  }

  async getTots(seasonId: string) {
    const selections = await this.prisma.teamOfTheSeason.findMany({
      where: { seasonId },
      include: { player: { include: { profile: true, stats: true } } },
      orderBy: { positionSlot: 'asc' },
    });

    return selections.map((s) => ({
      position: s.positionSlot,
      positionLabel: POSITION_LABELS[s.positionSlot],
      userId: s.userId,
      nickname: s.player.profile?.nickname,
      avatar: s.player.profile?.avatar,
      cardRating: s.player.stats?.cardRating ?? 75,
    }));
  }

  // --- StatTracker ---

  async listSeasonMatches(seasonId?: string) {
    const matches = await this.prisma.seasonMatch.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: {
        season: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        _count: { select: { playerStats: true } },
      },
      orderBy: [{ playedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return matches.map((m) => ({
      id: m.id,
      season: m.season,
      division: m.division,
      roundNumber: m.roundNumber,
      weekLabel: m.weekLabel,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      playedAt: m.playedAt?.toISOString() ?? null,
      statsCount: m._count.playerStats,
    }));
  }

  async createSeasonMatch(dto: CreateSeasonMatchDto) {
    if (dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException('Команды должны быть разными');
    }

    const season = await this.prisma.season.findUnique({ where: { id: dto.seasonId } });
    if (!season) throw new NotFoundException('Сезон не найден');

    const match = await this.prisma.seasonMatch.create({
      data: {
        seasonId: dto.seasonId,
        divisionId: dto.divisionId,
        roundNumber: dto.roundNumber ?? 1,
        weekLabel: dto.weekLabel,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        playedAt: dto.playedAt ? new Date(dto.playedAt) : undefined,
      },
      include: {
        season: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
      },
    });

    return match;
  }

  async completeSeasonMatch(matchId: string, dto: CompleteSeasonMatchDto) {
    const match = await this.prisma.seasonMatch.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Матч не найден');

    const updated = await this.prisma.seasonMatch.update({
      where: { id: matchId },
      data: {
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        status: SeasonMatchStatus.COMPLETED,
        playedAt: dto.playedAt ? new Date(dto.playedAt) : new Date(),
      },
    });

    await this.seasonStandings.recalculateAfterMatch(matchId);
    return updated;
  }

  async submitMatchStats(matchId: string, enteredById: string, players: PlayerStatEntryDto[]) {
    const match = await this.prisma.seasonMatch.findUnique({
      where: { id: matchId },
      include: {
        season: true,
        division: true,
      },
    });
    if (!match) throw new NotFoundException('Матч не найден');

    const divisionTier = match.division?.name ?? DivisionTier.NONE;

    const results = await this.prisma.$transaction(async (tx) => {
      const created: { id: string; userId: string; xpEarned: number }[] = [];

      for (const entry of players) {
        const existing = await tx.playerMatchStat.findUnique({
          where: { seasonMatchId_userId: { seasonMatchId: matchId, userId: entry.userId } },
        });
        if (existing) {
          throw new ConflictException(`Статистика для игрока ${entry.userId} уже внесена`);
        }

        const xpEarned = this.xpCalculator.calculateXp(
          entry.positionPlayed,
          {
            passAccuracy: entry.passAccuracy,
            dribbles: entry.dribbles,
            tacklesWon: entry.tacklesWon,
            goals: entry.goals,
            assists: entry.assists,
            saves: entry.saves,
            interceptions: entry.interceptions,
            fouls: entry.fouls,
            cleanSheet: entry.cleanSheet,
          },
          divisionTier,
        );

        const stat = await tx.playerMatchStat.create({
          data: {
            seasonMatchId: matchId,
            userId: entry.userId,
            positionPlayed: entry.positionPlayed,
            passAccuracy: entry.passAccuracy,
            dribbles: entry.dribbles,
            tacklesWon: entry.tacklesWon,
            goals: entry.goals,
            assists: entry.assists,
            saves: entry.saves ?? 0,
            interceptions: entry.interceptions ?? 0,
            fouls: entry.fouls ?? 0,
            cleanSheet: entry.cleanSheet ?? false,
            otherMetrics: entry.otherMetrics ? (entry.otherMetrics as Prisma.InputJsonValue) : undefined,
            xpEarned,
            enteredById,
          },
        });

        await this.upsertSeasonXpSummary(tx, match.seasonId, entry.userId, xpEarned);
        created.push({ id: stat.id, userId: stat.userId, xpEarned: stat.xpEarned });
      }

      if (match.status !== SeasonMatchStatus.COMPLETED) {
        await tx.seasonMatch.update({
          where: { id: matchId },
          data: { status: SeasonMatchStatus.COMPLETED, playedAt: match.playedAt ?? new Date() },
        });
      }

      return created;
    });

    return results;
  }

  /** Импорт статистики из EA API (автопайплайн 12.7.1) — переиспользует XP из submitMatchStats. */
  async importEaPlayerStats(
    matchId: string,
    enteredById: string,
    players: PlayerStatEntryDto[],
  ) {
    return this.submitMatchStats(matchId, enteredById, players);
  }

  /** EA-импорт: пропускает игроков, у которых статистика уже есть. */
  async importEaPlayerStatsSkipExisting(
    matchId: string,
    enteredById: string,
    players: PlayerStatEntryDto[],
  ) {
    const match = await this.prisma.seasonMatch.findUnique({
      where: { id: matchId },
      include: { season: true, division: true },
    });
    if (!match) throw new NotFoundException('Матч не найден');

    const divisionTier = match.division?.name ?? DivisionTier.NONE;
    const existingUserIds = new Set(
      (
        await this.prisma.playerMatchStat.findMany({
          where: { seasonMatchId: matchId },
          select: { userId: true },
        })
      ).map((s) => s.userId),
    );

    const toImport = players.filter((p) => !existingUserIds.has(p.userId));
    if (toImport.length === 0) return [];

    const results = await this.prisma.$transaction(async (tx) => {
      const created: { id: string; userId: string; xpEarned: number }[] = [];

      for (const entry of toImport) {
        const xpEarned = this.xpCalculator.calculateXp(
          entry.positionPlayed,
          {
            passAccuracy: entry.passAccuracy,
            dribbles: entry.dribbles,
            tacklesWon: entry.tacklesWon,
            goals: entry.goals,
            assists: entry.assists,
            saves: entry.saves,
            interceptions: entry.interceptions,
            fouls: entry.fouls,
            cleanSheet: entry.cleanSheet,
          },
          divisionTier,
        );

        const stat = await tx.playerMatchStat.create({
          data: {
            seasonMatchId: matchId,
            userId: entry.userId,
            positionPlayed: entry.positionPlayed,
            passAccuracy: entry.passAccuracy,
            dribbles: entry.dribbles,
            tacklesWon: entry.tacklesWon,
            goals: entry.goals,
            assists: entry.assists,
            saves: entry.saves ?? 0,
            interceptions: entry.interceptions ?? 0,
            fouls: entry.fouls ?? 0,
            cleanSheet: entry.cleanSheet ?? false,
            otherMetrics: entry.otherMetrics ? (entry.otherMetrics as Prisma.InputJsonValue) : undefined,
            xpEarned,
            enteredById,
          },
        });

        await this.upsertSeasonXpSummary(tx, match.seasonId, entry.userId, xpEarned);
        created.push({ id: stat.id, userId: stat.userId, xpEarned: stat.xpEarned });
      }

      return created;
    });

    return results;
  }

  /** EA-импорт статистики для турнирного матча. */
  async importEaTournamentPlayerStatsSkipExisting(
    tournamentMatchId: string,
    enteredById: string,
    players: PlayerStatEntryDto[],
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: tournamentMatchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Турнирный матч не найден');

    const existingUserIds = new Set(
      (
        await this.prisma.playerMatchStat.findMany({
          where: { tournamentMatchId },
          select: { userId: true },
        })
      ).map((s) => s.userId),
    );

    const toImport = players.filter((p) => !existingUserIds.has(p.userId));
    if (toImport.length === 0) return [];

    const results = await this.prisma.$transaction(async (tx) => {
      const created: { id: string; userId: string; xpEarned: number }[] = [];

      for (const entry of toImport) {
        const xpEarned = this.xpCalculator.calculateXp(
          entry.positionPlayed,
          {
            passAccuracy: entry.passAccuracy,
            dribbles: entry.dribbles,
            tacklesWon: entry.tacklesWon,
            goals: entry.goals,
            assists: entry.assists,
            saves: entry.saves,
            interceptions: entry.interceptions,
            fouls: entry.fouls,
            cleanSheet: entry.cleanSheet,
          },
          DivisionTier.NONE,
        );

        const stat = await tx.playerMatchStat.create({
          data: {
            tournamentMatchId,
            userId: entry.userId,
            positionPlayed: entry.positionPlayed,
            passAccuracy: entry.passAccuracy,
            dribbles: entry.dribbles,
            tacklesWon: entry.tacklesWon,
            goals: entry.goals,
            assists: entry.assists,
            saves: entry.saves ?? 0,
            interceptions: entry.interceptions ?? 0,
            fouls: entry.fouls ?? 0,
            cleanSheet: entry.cleanSheet ?? false,
            otherMetrics: entry.otherMetrics ? (entry.otherMetrics as Prisma.InputJsonValue) : undefined,
            xpEarned,
            enteredById,
          },
        });

        created.push({ id: stat.id, userId: stat.userId, xpEarned: stat.xpEarned });
      }

      return created;
    });

    return results;
  }

  async getPublicSeasonMatches(seasonId: string) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Сезон не найден');
    return this.listSeasonMatches(seasonId);
  }

  async getSeasonMatchDetail(matchId: string) {
    const match = await this.prisma.seasonMatch.findUnique({
      where: { id: matchId },
      include: {
        season: { select: { id: true, name: true, status: true } },
        division: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        playerStats: { select: { userId: true, xpEarned: true } },
      },
    });
    if (!match) throw new NotFoundException('Матч не найден');

    const eaImport = await this.prisma.eaApiMatchImport.findFirst({
      where: { matchedSeasonMatchId: matchId, importStatus: 'IMPORTED' },
      orderBy: { importedAt: 'desc' },
      select: { rawJson: true },
    });

    const { homeEaPlayers, awayEaPlayers, statsCount } = await this.buildEaMatchPlayerTables({
      teamAId: match.homeTeamId,
      teamBId: match.awayTeamId,
      eaImportRawJson: eaImport?.rawJson ?? null,
      dbPlayerStats: match.playerStats,
    });

    return {
      id: match.id,
      season: match.season,
      division: match.division,
      roundNumber: match.roundNumber,
      weekLabel: match.weekLabel,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: match.status,
      playedAt: match.playedAt?.toISOString() ?? null,
      eaMatchId: match.eaMatchId,
      statsCount,
      homeEaPlayers,
      awayEaPlayers,
    };
  }

  /** Полная FIFA-статистика игроков из raw JSON EA import + XP из PlayerMatchStat. */
  async buildEaMatchPlayerTables(params: {
    teamAId: string;
    teamBId: string;
    eaImportRawJson: unknown | null;
    dbPlayerStats: { userId: string; xpEarned: number }[];
  }) {
    const { teamAId, teamBId, eaImportRawJson, dbPlayerStats } = params;

    const [linkA, linkB, membersA, membersB] = await Promise.all([
      this.prisma.eaClubLink.findUnique({ where: { teamId: teamAId } }),
      this.prisma.eaClubLink.findUnique({ where: { teamId: teamBId } }),
      this.prisma.teamMember.findMany({
        where: { teamId: teamAId },
        include: { user: { select: { id: true, profile: { select: { gamerTag: true } } } } },
      }),
      this.prisma.teamMember.findMany({
        where: { teamId: teamBId },
        include: { user: { select: { id: true, profile: { select: { gamerTag: true } } } } },
      }),
    ]);

    const gamerTagToUserId = new Map<string, string>();
    for (const m of [...membersA, ...membersB]) {
      const tag = m.user.profile?.gamerTag?.trim().toLowerCase();
      if (tag) gamerTagToUserId.set(tag, m.user.id);
    }

    const formatEaPlayer = (p: ReturnType<typeof parseEaClubPlayersFromMatchRaw>[number]) => ({
      playerName: p.playerName,
      userId: gamerTagToUserId.get(p.playerName.toLowerCase()) ?? null,
      position: p.position,
      rating: p.rating,
      goals: p.goals,
      assists: p.assists,
      shots: p.shots,
      passAttempts: p.passAttempts,
      passesMade: p.passesMade,
      passAccuracy: p.passAccuracy,
      tackleAttempts: p.tackleAttempts,
      tacklesMade: p.tacklesMade,
      saves: p.saves,
      ballDiveSaves: p.ballDiveSaves,
      crossSaves: p.crossSaves,
      goodDirectionSaves: p.goodDirectionSaves,
      parrySaves: p.parrySaves,
      punchSaves: p.punchSaves,
      reflexSaves: p.reflexSaves,
      goalsConceded: p.goalsConceded,
      cleanSheetAny: p.cleanSheetAny,
      cleanSheetDef: p.cleanSheetDef,
      cleanSheetGk: p.cleanSheetGk,
      redCards: p.redCards,
      minutesPlayed: p.minutesPlayed,
      manOfTheMatch: p.manOfTheMatch,
      vproAttr: p.vproAttr,
    });

    let teamAEaPlayers: ReturnType<typeof formatEaPlayer>[] = [];
    let teamBEaPlayers: ReturnType<typeof formatEaPlayer>[] = [];

    if (eaImportRawJson && linkA?.eaClubId) {
      teamAEaPlayers = parseEaClubPlayersFromMatchRaw(eaImportRawJson, linkA.eaClubId).map(
        formatEaPlayer,
      );
    }
    if (eaImportRawJson && linkB?.eaClubId) {
      teamBEaPlayers = parseEaClubPlayersFromMatchRaw(eaImportRawJson, linkB.eaClubId).map(
        formatEaPlayer,
      );
    }

    const dbStatByUserId = new Map(dbPlayerStats.map((s) => [s.userId, s]));

    const enrichWithXp = (ea: ReturnType<typeof formatEaPlayer>) => {
      const db = ea.userId ? dbStatByUserId.get(ea.userId) : undefined;
      return {
        ...ea,
        xpEarned: db?.xpEarned ?? null,
        pitchzoneLinked: Boolean(ea.userId),
      };
    };

    const homeEaPlayers = teamAEaPlayers.map(enrichWithXp);
    const awayEaPlayers = teamBEaPlayers.map(enrichWithXp);

    return {
      homeEaPlayers,
      awayEaPlayers,
      statsCount: homeEaPlayers.length + awayEaPlayers.length || dbPlayerStats.length,
    };
  }

  async setTotw(seasonId: string, dto: TotwSelectionDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.teamOfTheWeek.deleteMany({
        where: { seasonId, weekNumber: dto.weekNumber },
      });

      for (const slot of dto.slots) {
        await tx.teamOfTheWeek.create({
          data: {
            seasonId,
            weekNumber: dto.weekNumber,
            positionSlot: slot.positionSlot,
            userId: slot.userId,
          },
        });
        await this.applyTotwBonus(tx, slot.userId);
      }
    });

    return this.getTotw(seasonId, dto.weekNumber);
  }

  async setTots(seasonId: string, dto: TotsSelectionDto) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Сезон не найден');

    await this.prisma.$transaction(async (tx) => {
      await tx.teamOfTheSeason.deleteMany({ where: { seasonId } });

      for (const slot of dto.slots) {
        await tx.teamOfTheSeason.create({
          data: {
            seasonId,
            positionSlot: slot.positionSlot,
            userId: slot.userId,
          },
        });

        const stats = await tx.playerStats.findUnique({ where: { userId: slot.userId } });
        if (stats) {
          await tx.playerStats.update({
            where: { userId: slot.userId },
            data: { cardRating: Math.min(CARD_RATING_MAX, stats.cardRating + 3) },
          });
        }
      }
    });

    return this.getTots(seasonId);
  }

  async recalculateSeasonRatings(seasonId: string) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Сезон не найден');
    if (season.status !== SeasonStatus.FINISHED) {
      throw new BadRequestException('Пересчёт доступен только для завершённого сезона');
    }

    const summaries = await this.prisma.seasonXpSummary.findMany({
      where: { seasonId },
      orderBy: { totalXp: 'desc' },
    });

    const eligible = summaries.filter((s) => s.matchesPlayed >= MIN_MATCHES_FOR_RECALC);
    const totalEligible = eligible.length;

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < summaries.length; i++) {
        const summary = summaries[i];
        const rank = i + 1;
        const isEligible = summary.matchesPlayed >= MIN_MATCHES_FOR_RECALC;

        await tx.seasonXpSummary.update({
          where: { id: summary.id },
          data: { rankInSeason: rank, eligibleForRecalculation: isEligible },
        });

        if (!isEligible) {
          await this.applyIneligibleRating(tx, summary.userId, seasonId);
          continue;
        }

        const eligibleIndex = eligible.findIndex((e) => e.userId === summary.userId);
        const percentile = totalEligible > 1 ? 1 - eligibleIndex / (totalEligible - 1) : 1;
        const targetRating = Math.round(CARD_RATING_MIN + percentile * (CARD_RATING_MAX - CARD_RATING_MIN - 10));

        await this.applySeasonRating(tx, summary.userId, seasonId, targetRating, 0, 0);
      }
    });

    return { seasonId, playersProcessed: summaries.length, eligibleCount: eligible.length };
  }

  private async upsertSeasonXpSummary(
    tx: Prisma.TransactionClient,
    seasonId: string,
    userId: string,
    xpEarned: number,
  ) {
    await tx.seasonXpSummary.upsert({
      where: { seasonId_userId: { seasonId, userId } },
      create: {
        seasonId,
        userId,
        totalXp: xpEarned,
        matchesPlayed: 1,
        eligibleForRecalculation: false,
      },
      update: {
        totalXp: { increment: xpEarned },
        matchesPlayed: { increment: 1 },
      },
    });
  }

  private async applyTotwBonus(tx: Prisma.TransactionClient, userId: string) {
    const stats = await tx.playerStats.findUnique({ where: { userId } });
    if (!stats) return;

    let newRating = stats.cardRating;
    if (stats.cardRating < 75 && stats.totwCount === 0) {
      newRating = 75;
    } else {
      newRating = Math.min(CARD_RATING_MAX, stats.cardRating + 1);
    }

    await tx.playerStats.update({
      where: { userId },
      data: { cardRating: newRating, totwCount: { increment: 1 } },
    });
  }

  private async applyIneligibleRating(
    tx: Prisma.TransactionClient,
    userId: string,
    seasonId: string,
  ) {
    const lastEligible = await tx.playerRatingHistory.findFirst({
      where: {
        userId,
        season: { status: SeasonStatus.FINISHED },
      },
      orderBy: { calculatedAt: 'desc' },
    });

    const currentStats = await tx.playerStats.findUnique({ where: { userId } });
    const previousRating = lastEligible?.finalRating ?? currentStats?.cardRating ?? 75;
    const penalized = Math.max(CARD_RATING_MIN, previousRating - INELIGIBLE_PENALTY);

    await this.applySeasonRating(tx, userId, seasonId, penalized, 0, 0);
  }

  private async applySeasonRating(
    tx: Prisma.TransactionClient,
    userId: string,
    seasonId: string,
    targetRating: number,
    totwBonus: number,
    totsBonus: number,
  ) {
    const stats = await tx.playerStats.findUnique({ where: { userId } });
    const previousRating = stats?.cardRating ?? 75;

    const clampedBase = Math.max(
      previousRating - MAX_RATING_DELTA,
      Math.min(previousRating + MAX_RATING_DELTA, targetRating),
    );
    const finalRating = Math.min(CARD_RATING_MAX, Math.max(CARD_RATING_MIN, clampedBase + totwBonus + totsBonus));

    await tx.playerStats.upsert({
      where: { userId },
      create: { userId, cardRating: finalRating },
      update: { cardRating: finalRating },
    });

    await tx.playerRatingHistory.upsert({
      where: { userId_seasonId: { userId, seasonId } },
      create: {
        userId,
        seasonId,
        baseRating: clampedBase,
        totwBonus,
        totsBonus,
        finalRating,
      },
      update: {
        baseRating: clampedBase,
        totwBonus,
        totsBonus,
        finalRating,
        calculatedAt: new Date(),
      },
    });
  }

  private formatPlayerMatchStat(stat: {
    id: string;
    positionPlayed: PlayerPosition;
    passAccuracy: number;
    dribbles: number;
    tacklesWon: number;
    goals: number;
    assists: number;
    saves: number;
    interceptions: number;
    fouls: number;
    cleanSheet: boolean;
    xpEarned: number;
    enteredAt: Date;
    seasonMatch: {
      id: string;
      homeScore: number | null;
      awayScore: number | null;
      playedAt: Date | null;
      season: { id: string; name: string };
      homeTeam: { id: string; name: string; tag: string };
      awayTeam: { id: string; name: string; tag: string };
      division: { name: DivisionTier } | null;
    };
  }) {
    return {
      id: stat.id,
      position: stat.positionPlayed,
      positionLabel: POSITION_LABELS[stat.positionPlayed],
      passAccuracy: stat.passAccuracy,
      dribbles: stat.dribbles,
      tacklesWon: stat.tacklesWon,
      goals: stat.goals,
      assists: stat.assists,
      saves: stat.saves,
      interceptions: stat.interceptions,
      fouls: stat.fouls,
      cleanSheet: stat.cleanSheet,
      xpEarned: stat.xpEarned,
      enteredAt: stat.enteredAt.toISOString(),
      match: {
        id: stat.seasonMatch.id,
        season: stat.seasonMatch.season,
        score: `${stat.seasonMatch.homeScore ?? '—'}:${stat.seasonMatch.awayScore ?? '—'}`,
        homeTeam: stat.seasonMatch.homeTeam,
        awayTeam: stat.seasonMatch.awayTeam,
        division: stat.seasonMatch.division?.name ?? null,
        playedAt: stat.seasonMatch.playedAt?.toISOString() ?? null,
      },
    };
  }
}
