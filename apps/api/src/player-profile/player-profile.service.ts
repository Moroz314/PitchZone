import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AwardCategory,
  ContractStatus,
  PlayerPosition,
  Prisma,
  TeamRole,
} from '@prisma/client';

import { POSITION_LABELS } from '../clubs/constants/club-colors';
import { PrismaService } from '../prisma/prisma.service';
import {
  POSITION_GROUP_LABELS,
  positionToGroup,
  xpToMatchRating,
  type StatCategoryId,
} from './constants/profile-stats.constants';

type MatchStatRow = Prisma.PlayerMatchStatGetPayload<{ include: typeof matchStatInclude }>;

const matchStatInclude = {
  seasonMatch: {
    include: {
      season: { select: { id: true, name: true } },
      homeTeam: { select: { id: true, name: true, tag: true, avatar: true } },
      awayTeam: { select: { id: true, name: true, tag: true, avatar: true } },
    },
  },
  tournamentMatch: {
    select: {
      id: true,
      score1: true,
      score2: true,
      scheduledAt: true,
      completedAt: true,
      tournamentId: true,
      participant1Id: true,
      participant2Id: true,
      participant1Name: true,
      participant2Name: true,
      tournament: { select: { id: true, slug: true, title: true } },
    },
  },
} satisfies Prisma.PlayerMatchStatInclude;

@Injectable()
export class PlayerProfileAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateCareerStats(userId: string) {
    const stats = await this.fetchMatchStats(userId);
    const seasonXpTotal = await this.prisma.seasonXpSummary.aggregate({
      where: { userId },
      _sum: { totalXp: true },
    });

    const totals = this.aggregateRows(stats);
    const totalXpFromMatches = totals.totalXp;
    const totalXp = seasonXpTotal._sum.totalXp ?? totalXpFromMatches;

    await this.prisma.playerCareerStat.upsert({
      where: { userId },
      create: {
        userId,
        totalMatches: totals.totalMatches,
        totalXp,
        avgMatchRating: totals.avgMatchRating,
        goals: totals.goals,
        assists: totals.assists,
        passAccuracyPercent: totals.passAccuracyPercent,
        successfulTackles: totals.tackles,
        interceptions: totals.interceptions,
        cleanSheets: totals.cleanSheets,
      },
      update: {
        totalMatches: totals.totalMatches,
        totalXp,
        avgMatchRating: totals.avgMatchRating,
        goals: totals.goals,
        assists: totals.assists,
        passAccuracyPercent: totals.passAccuracyPercent,
        successfulTackles: totals.tackles,
        interceptions: totals.interceptions,
        cleanSheets: totals.cleanSheets,
        recalculatedAt: new Date(),
      },
    });

    await this.recalculatePositionStats(userId, stats);
    await this.updateGlobalRanks(userId);

    return this.prisma.playerCareerStat.findUnique({ where: { userId } });
  }

  async getOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        profileExtra: true,
        stats: true,
        teamMembers: {
          include: {
            team: { select: { id: true, name: true, tag: true, avatar: true } },
          },
        },
        gamertagHistory: { orderBy: { validFrom: 'desc' } },
        playerContracts: {
          where: { status: { in: [ContractStatus.ACTIVE, ContractStatus.ACCEPTED] } },
          include: { team: { select: { id: true, name: true, tag: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        userAwards: {
          where: { isPinned: true },
          include: { award: true },
          orderBy: { awardedAt: 'desc' },
          take: 6,
        },
      },
    });

    if (!user?.profile) throw new NotFoundException('Игрок не найден');

    let career = await this.prisma.playerCareerStat.findUnique({ where: { userId } });
    if (!career || this.isStale(career.recalculatedAt)) {
      career = (await this.recalculateCareerStats(userId)) ?? career;
    }

    const positionStats = await this.prisma.playerPositionStat.findMany({
      where: { userId },
      orderBy: { percentOfTotal: 'desc' },
    });

    const positionGroups = this.buildPositionGroups(positionStats);
    const cardAttributes = this.buildCardAttributes(career, user.stats?.cardRating ?? 75);
    const currentTeam = user.teamMembers[0]?.team ?? null;
    const currentRole = user.teamMembers[0]?.role ?? null;
    const activeContract = user.playerContracts[0] ?? null;

    return {
      player: {
        id: user.id,
        nickname: user.profile.nickname,
        avatar: user.profile.avatar,
        gamerTag: user.profile.gamerTag,
        country: user.profile.country,
        countryCode: user.profile.countryCode,
        city: user.profile.city,
        bio: user.profile.bio,
        primaryPosition: user.profile.primaryPosition,
        primaryPositionLabel: user.profile.primaryPosition
          ? POSITION_LABELS[user.profile.primaryPosition]
          : null,
        secondaryPositions: user.profileExtra?.secondaryPositions ?? [],
        fullName: user.profileExtra?.fullName ?? null,
        birthDate: user.profileExtra?.birthDate?.toISOString().split('T')[0] ?? null,
        premiumUntil: user.profileExtra?.premiumUntil?.toISOString() ?? null,
        joinedAt: user.createdAt.toISOString().split('T')[0],
        socialLinks: {
          vk: user.profile.vkUrl,
          telegram: user.profile.telegramUrl,
          discord: user.profile.discordUsername,
        },
      },
      card: {
        rating: user.stats?.cardRating ?? 75,
        position: user.profile.primaryPosition,
        positionLabel: user.profile.primaryPosition
          ? POSITION_LABELS[user.profile.primaryPosition]
          : '—',
        attributes: cardAttributes,
        currentTeam,
      },
      contract: activeContract
        ? {
            team: activeContract.team,
            status: activeContract.status,
            role: this.roleLabel(currentRole),
            endDate: activeContract.endDate?.toISOString() ?? null,
            isIndefinite: !activeContract.endDate,
            buyoutFee: activeContract.buyoutFee,
            contractId: activeContract.id,
          }
        : currentTeam
          ? {
              team: currentTeam,
              status: 'MEMBER',
              role: this.roleLabel(currentRole),
              endDate: null,
              isIndefinite: true,
              buyoutFee: null,
              contractId: null,
            }
          : null,
      career: career
        ? {
            totalMatches: career.totalMatches,
            totalXp: career.totalXp,
            avgMatchRating: career.avgMatchRating,
            goals: career.goals,
            assists: career.assists,
            passAccuracyPercent: career.passAccuracyPercent,
            successfulTackles: career.successfulTackles,
            interceptions: career.interceptions,
            cleanSheets: career.cleanSheets,
            ranks: {
              totalMatches: career.rankTotalMatches,
              totalXp: career.rankTotalXp,
              avgRating: career.rankAvgRating,
              goals: career.rankGoals,
              assists: career.rankAssists,
              passAccuracy: career.rankPassAccuracy,
              tackles: career.rankTackles,
              interceptions: career.rankInterceptions,
              cleanSheets: career.rankCleanSheets,
            },
          }
        : null,
      favoritePositions: positionGroups,
      positionRatings: positionStats.map((p) => ({
        position: p.position,
        positionLabel: POSITION_LABELS[p.position],
        positionGroup: p.positionGroup,
        positionGroupLabel: POSITION_GROUP_LABELS[p.positionGroup] ?? p.positionGroup,
        matchesPlayed: p.matchesPlayed,
        percentOfTotal: p.percentOfTotal,
        avgMatchRating: p.avgMatchRating,
      })),
      pinnedAwards: user.userAwards.map((ua) => ({
        id: ua.id,
        name: ua.award.name,
        description: ua.award.description,
        category: ua.award.category,
        iconEmoji: ua.award.iconEmoji,
        awardedForText: ua.awardedForText,
        awardedAt: ua.awardedAt.toISOString(),
      })),
      gamertagHistory: user.gamertagHistory.map((h) => ({
        gamerTag: h.gamerTag,
        validFrom: h.validFrom.toISOString(),
        validTo: h.validTo?.toISOString() ?? null,
        isCurrent: h.validTo === null,
      })),
    };
  }

  async getStatistics(
    userId: string,
    tab: 'season' | 'tournament' | 'club' | 'match' = 'season',
    position?: PlayerPosition,
    category: StatCategoryId = 'summary',
  ) {
    const userTeamIds = await this.getUserTeamIds(userId);
    const stats = await this.fetchMatchStats(userId, position);
    const tournamentCtx = await this.buildTournamentTeamContext(stats);

    if (tab === 'match') {
      return {
        tab,
        position: position ?? null,
        category,
        rows: stats.map((s) => this.formatMatchRow(s, category)),
      };
    }

    if (tab === 'tournament') {
      const tournamentIds = [
        ...new Set(
          stats
            .filter((s) => s.tournamentMatch)
            .map((s) => s.tournamentMatch!.tournamentId),
        ),
      ];

      const stored = await this.prisma.playerTournamentStat.findMany({
        where: { userId, tournamentId: { in: tournamentIds } },
        include: { tournament: { select: { id: true, slug: true, title: true } } },
      });
      const storedByTournament = new Map(stored.map((s) => [s.tournamentId, s]));

      const rows = tournamentIds.map((tournamentId) => {
        const tournamentStats = stats.filter((s) => s.tournamentMatch?.tournamentId === tournamentId);
        const agg = this.aggregateRows(tournamentStats);
        const summary = storedByTournament.get(tournamentId);
        return {
          tournamentId,
          tournamentSlug: tournamentStats[0]?.tournamentMatch?.tournament.slug,
          tournamentName: tournamentStats[0]?.tournamentMatch?.tournament.title,
          matchesPlayed: summary?.matchesPlayed ?? agg.totalMatches,
          ...agg,
          totalXp: summary?.totalXp ?? agg.totalXp,
          winPercent: this.calcWinPercent(tournamentStats, userTeamIds, tournamentCtx),
        };
      });

      return { tab, position: position ?? null, category, rows };
    }

    if (tab === 'club') {
      const teamIds = new Set<string>();
      for (const s of stats) {
        const teamId = this.resolvePlayerTeamId(s, userTeamIds, tournamentCtx);
        if (teamId) teamIds.add(teamId);
      }

      const rows = [...teamIds].map((teamId) => {
        const teamStats = stats.filter(
          (s) => this.resolvePlayerTeamId(s, userTeamIds, tournamentCtx) === teamId,
        );
        const seasonRow = teamStats.find((s) => s.seasonMatch);
        const team = seasonRow
          ? seasonRow.seasonMatch!.homeTeam.id === teamId
            ? seasonRow.seasonMatch!.homeTeam
            : seasonRow.seasonMatch!.awayTeam
          : null;
        return {
          teamId,
          teamName: team?.name,
          teamTag: team?.tag,
          teamAvatar: team?.avatar,
          ...this.aggregateRows(teamStats),
        };
      });

      return { tab, position: position ?? null, category, rows };
    }

    const seasonStats = stats.filter((s) => s.seasonMatch);
    const seasonIds = [...new Set(seasonStats.map((s) => s.seasonMatch!.seasonId))];
    const seasonSummaries = await this.prisma.seasonXpSummary.findMany({
      where: { userId, seasonId: { in: seasonIds } },
    });
    const xpBySeason = new Map(seasonSummaries.map((s) => [s.seasonId, s]));

    const rows = seasonIds.map((seasonId) => {
      const seasonOnlyStats = seasonStats.filter((s) => s.seasonMatch!.seasonId === seasonId);
      const agg = this.aggregateRows(seasonOnlyStats);
      const summary = xpBySeason.get(seasonId);
      return {
        seasonId,
        seasonName: seasonOnlyStats[0]?.seasonMatch?.season.name,
        xpEarned: summary?.totalXp ?? agg.totalXp,
        matchesPlayed: summary?.matchesPlayed ?? agg.totalMatches,
        ...agg,
        winPercent: this.calcWinPercent(seasonOnlyStats, userTeamIds, tournamentCtx),
      };
    });

    return { tab, position: position ?? null, category, rows };
  }

  async getTransfers(userId: string) {
    const userTeamIds = await this.getUserTeamIds(userId);
    const [memberships, contracts, stats] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: { userId },
        include: { team: { select: { id: true, name: true, tag: true, avatar: true } } },
        orderBy: { joinedAt: 'desc' },
      }),
      this.prisma.contract.findMany({
        where: { userId, status: { not: ContractStatus.PENDING } },
        include: { team: { select: { id: true, name: true, tag: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.fetchMatchStats(userId),
    ]);

    const tournamentCtx = await this.buildTournamentTeamContext(stats);

    return memberships.map((membership) => {
      const teamContracts = contracts.filter((c) => c.teamId === membership.teamId);
      const activeContract = teamContracts.find((c) => c.status === ContractStatus.ACTIVE);
      const lastContract = teamContracts[0];
      const teamStats = stats.filter(
        (s) => this.resolvePlayerTeamId(s, userTeamIds, tournamentCtx) === membership.teamId,
      );
      const agg = this.aggregateRows(teamStats);
      const joinedAt = activeContract?.startDate ?? membership.joinedAt;
      const isCurrent = userTeamIds.has(membership.teamId);
      const leftAt = isCurrent ? null : lastContract?.endDate ?? null;

      const daysInClub = Math.max(
        1,
        Math.floor(
          ((leftAt ? new Date(leftAt) : new Date()).getTime() - new Date(joinedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

      return {
        team: membership.team,
        matchesPlayed: agg.totalMatches,
        avgMatchRating: agg.avgMatchRating,
        captainStarRating:
          membership.role === TeamRole.CAPTAIN ? 4.5 : membership.role === TeamRole.OWNER ? 5 : null,
        joinedAt: joinedAt.toISOString(),
        leftAt: leftAt?.toISOString() ?? null,
        isCurrent,
        daysInClub,
        role: membership.role,
      };
    });
  }

  async getAwards(userId: string, category?: AwardCategory) {
    const awards = await this.prisma.userAward.findMany({
      where: {
        userId,
        ...(category ? { award: { category } } : {}),
      },
      include: { award: true },
      orderBy: { awardedAt: 'desc' },
    });

    return awards.map((ua) => ({
      id: ua.id,
      awardId: ua.awardId,
      slug: ua.award.slug,
      name: ua.award.name,
      description: ua.award.description,
      category: ua.award.category,
      iconEmoji: ua.award.iconEmoji,
      awardedForText: ua.awardedForText,
      awardedAt: ua.awardedAt.toISOString(),
      isPinned: ua.isPinned,
    }));
  }

  async pinAward(userId: string, userAwardId: string, pinned: boolean) {
    const award = await this.prisma.userAward.findFirst({
      where: { id: userAwardId, userId },
    });
    if (!award) throw new NotFoundException('Награда не найдена');

    if (pinned) {
      const pinnedCount = await this.prisma.userAward.count({
        where: { userId, isPinned: true },
      });
      if (pinnedCount >= 6 && !award.isPinned) {
        await this.prisma.userAward.updateMany({
          where: { userId, isPinned: true },
          data: { isPinned: false },
        });
      }
    }

    return this.prisma.userAward.update({
      where: { id: userAwardId },
      data: { isPinned: pinned },
      include: { award: true },
    });
  }

  private async fetchMatchStats(userId: string, position?: PlayerPosition) {
    return this.prisma.playerMatchStat.findMany({
      where: { userId, ...(position ? { positionPlayed: position } : {}) },
      include: matchStatInclude,
      orderBy: { enteredAt: 'desc' },
    }) as Promise<MatchStatRow[]>;
  }

  private aggregateRows(rows: MatchStatRow[]) {
    if (rows.length === 0) {
      return {
        totalMatches: 0,
        totalXp: 0,
        avgMatchRating: 0,
        goals: 0,
        assists: 0,
        goalsPlusAssists: 0,
        passAccuracyPercent: 0,
        dribbles: 0,
        tackles: 0,
        interceptions: 0,
        saves: 0,
        cleanSheets: 0,
        fouls: 0,
        impactRating: 0,
      };
    }

    const n = rows.length;
    const totals = rows.reduce(
      (acc, r) => ({
        xp: acc.xp + r.xpEarned,
        goals: acc.goals + r.goals,
        assists: acc.assists + r.assists,
        pass: acc.pass + r.passAccuracy,
        dribbles: acc.dribbles + r.dribbles,
        tackles: acc.tackles + r.tacklesWon,
        interceptions: acc.interceptions + r.interceptions,
        saves: acc.saves + r.saves,
        cleanSheets: acc.cleanSheets + (r.cleanSheet ? 1 : 0),
        fouls: acc.fouls + r.fouls,
        rating: acc.rating + xpToMatchRating(r.xpEarned),
      }),
      {
        xp: 0,
        goals: 0,
        assists: 0,
        pass: 0,
        dribbles: 0,
        tackles: 0,
        interceptions: 0,
        saves: 0,
        cleanSheets: 0,
        fouls: 0,
        rating: 0,
      },
    );

    return {
      totalMatches: n,
      totalXp: totals.xp,
      avgMatchRating: Math.round((totals.rating / n) * 100) / 100,
      goals: totals.goals,
      assists: totals.assists,
      goalsPlusAssists: totals.goals + totals.assists,
      passAccuracyPercent: Math.round((totals.pass / n) * 10) / 10,
      dribbles: totals.dribbles,
      tackles: totals.tackles,
      interceptions: totals.interceptions,
      saves: totals.saves,
      cleanSheets: totals.cleanSheets,
      fouls: totals.fouls,
      impactRating: Math.round(((totals.goals * 3 + totals.assists * 2 + totals.xp / n) / 10) * 100) / 100,
    };
  }

  private async recalculatePositionStats(userId: string, stats: MatchStatRow[]) {
    await this.prisma.playerPositionStat.deleteMany({ where: { userId } });

    if (stats.length === 0) return;

    const byPosition = new Map<PlayerPosition, MatchStatRow[]>();
    for (const s of stats) {
      const list = byPosition.get(s.positionPlayed) ?? [];
      list.push(s);
      byPosition.set(s.positionPlayed, list);
    }

    const total = stats.length;
    for (const [position, rows] of byPosition) {
      const agg = this.aggregateRows(rows);
      await this.prisma.playerPositionStat.create({
        data: {
          userId,
          position,
          positionGroup: positionToGroup(position),
          matchesPlayed: rows.length,
          percentOfTotal: Math.round((rows.length / total) * 1000) / 10,
          avgMatchRating: agg.avgMatchRating,
        },
      });
    }
  }

  private buildPositionGroups(
    positionStats: { positionGroup: string; matchesPlayed: number; percentOfTotal: number }[],
  ) {
    const groups = new Map<string, { matches: number; percent: number }>();
    for (const p of positionStats) {
      const existing = groups.get(p.positionGroup) ?? { matches: 0, percent: 0 };
      groups.set(p.positionGroup, {
        matches: existing.matches + p.matchesPlayed,
        percent: existing.percent + p.percentOfTotal,
      });
    }

    return [...groups.entries()]
      .map(([group, data]) => ({
        group,
        label: POSITION_GROUP_LABELS[group] ?? group,
        matchesPlayed: data.matches,
        percentOfTotal: Math.round(data.percent * 10) / 10,
      }))
      .sort((a, b) => b.percentOfTotal - a.percentOfTotal);
  }

  private buildCardAttributes(
    career: {
      goals: number;
      assists: number;
      passAccuracyPercent: number;
      successfulTackles: number;
      interceptions: number;
      avgMatchRating: number;
    } | null,
    cardRating: number,
  ) {
    const base = cardRating;
    const c = career ?? {
      goals: 0,
      assists: 0,
      passAccuracyPercent: 0,
      successfulTackles: 0,
      interceptions: 0,
      avgMatchRating: 0,
    };

    return {
      attack: Math.min(99, Math.round(base * 0.4 + c.goals * 4 + c.assists * 2)),
      passing: Math.min(99, Math.round(base * 0.5 + c.passAccuracyPercent * 0.4)),
      dribbling: Math.min(99, Math.round(base * 0.45 + c.avgMatchRating * 3)),
      creation: Math.min(99, Math.round(base * 0.45 + c.assists * 5)),
      defense: Math.min(99, Math.round(base * 0.4 + c.successfulTackles * 2 + c.interceptions)),
      physical: Math.min(99, Math.round(base * 0.5 + c.avgMatchRating * 2)),
    };
  }

  private async updateGlobalRanks(userId: string) {
    const allAgg = await this.prisma.playerMatchStat.groupBy({
      by: ['userId'],
      _sum: {
        goals: true,
        assists: true,
        tacklesWon: true,
        interceptions: true,
        xpEarned: true,
      },
      _avg: { passAccuracy: true },
      _count: { id: true },
    });

    const xpSummaries = await this.prisma.seasonXpSummary.groupBy({
      by: ['userId'],
      _sum: { totalXp: true },
    });
    const xpMap = new Map(xpSummaries.map((s) => [s.userId, s._sum.totalXp ?? 0]));

    const ratings = await Promise.all(
      allAgg.map(async (row) => {
        const stats = await this.prisma.playerMatchStat.findMany({
          where: { userId: row.userId },
          select: { xpEarned: true },
        });
        const avgRating =
          stats.length > 0
            ? stats.reduce((s, r) => s + xpToMatchRating(r.xpEarned), 0) / stats.length
            : 0;
        return { userId: row.userId, avgRating };
      }),
    );
    const ratingMap = new Map(ratings.map((r) => [r.userId, r.avgRating]));

    const cleanSheets = await this.prisma.playerMatchStat.groupBy({
      by: ['userId'],
      where: { cleanSheet: true },
      _count: { id: true },
    });
    const cleanMap = new Map(cleanSheets.map((c) => [c.userId, c._count.id]));

    const metrics = allAgg.map((row) => ({
      userId: row.userId,
      totalMatches: row._count.id,
      totalXp: xpMap.get(row.userId) ?? row._sum.xpEarned ?? 0,
      avgRating: ratingMap.get(row.userId) ?? 0,
      goals: row._sum.goals ?? 0,
      assists: row._sum.assists ?? 0,
      passAccuracy: row._avg.passAccuracy ?? 0,
      tackles: row._sum.tacklesWon ?? 0,
      interceptions: row._sum.interceptions ?? 0,
      cleanSheets: cleanMap.get(row.userId) ?? 0,
    }));

    const rank = (values: number[], value: number) =>
      values.filter((v) => v > value).length + 1;

    const userMetric = metrics.find((m) => m.userId === userId);
    if (!userMetric) return;

    await this.prisma.playerCareerStat.update({
      where: { userId },
      data: {
        rankTotalMatches: rank(
          metrics.map((m) => m.totalMatches),
          userMetric.totalMatches,
        ),
        rankTotalXp: rank(
          metrics.map((m) => m.totalXp),
          userMetric.totalXp,
        ),
        rankAvgRating: rank(
          metrics.map((m) => m.avgRating),
          userMetric.avgRating,
        ),
        rankGoals: rank(
          metrics.map((m) => m.goals),
          userMetric.goals,
        ),
        rankAssists: rank(
          metrics.map((m) => m.assists),
          userMetric.assists,
        ),
        rankPassAccuracy: rank(
          metrics.map((m) => m.passAccuracy),
          userMetric.passAccuracy,
        ),
        rankTackles: rank(
          metrics.map((m) => m.tackles),
          userMetric.tackles,
        ),
        rankInterceptions: rank(
          metrics.map((m) => m.interceptions),
          userMetric.interceptions,
        ),
        rankCleanSheets: rank(
          metrics.map((m) => m.cleanSheets),
          userMetric.cleanSheets,
        ),
      },
    });
  }

  private async getUserTeamIds(userId: string) {
    const members = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    return new Set(members.map((m) => m.teamId));
  }

  private async buildTournamentTeamContext(stats: MatchStatRow[]) {
    const matchIds = stats
      .map((s) => s.tournamentMatchId)
      .filter((id): id is string => id != null);
    if (matchIds.length === 0) return new Map<string, { p1TeamId: string | null; p2TeamId: string | null }>();

    const matches = await this.prisma.match.findMany({
      where: { id: { in: matchIds } },
      select: { id: true, participant1Id: true, participant2Id: true },
    });

    const participantIds = [
      ...new Set(
        matches.flatMap((m) => [m.participant1Id, m.participant2Id].filter(Boolean) as string[]),
      ),
    ];

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, teamId: true },
    });

    const teamByParticipant = new Map(participants.map((p) => [p.id, p.teamId]));

    return new Map(
      matches.map((m) => [
        m.id,
        {
          p1TeamId: m.participant1Id ? (teamByParticipant.get(m.participant1Id) ?? null) : null,
          p2TeamId: m.participant2Id ? (teamByParticipant.get(m.participant2Id) ?? null) : null,
        },
      ]),
    );
  }

  private resolvePlayerTeamId(
    stat: MatchStatRow,
    userTeamIds: Set<string>,
    tournamentCtx?: Map<string, { p1TeamId: string | null; p2TeamId: string | null }>,
  ): string | null {
    if (stat.seasonMatch) {
      if (userTeamIds.has(stat.seasonMatch.homeTeamId)) return stat.seasonMatch.homeTeamId;
      if (userTeamIds.has(stat.seasonMatch.awayTeamId)) return stat.seasonMatch.awayTeamId;
      return null;
    }

    if (stat.tournamentMatchId && tournamentCtx) {
      const ctx = tournamentCtx.get(stat.tournamentMatchId);
      if (!ctx) return null;
      if (ctx.p1TeamId && userTeamIds.has(ctx.p1TeamId)) return ctx.p1TeamId;
      if (ctx.p2TeamId && userTeamIds.has(ctx.p2TeamId)) return ctx.p2TeamId;
    }

    return null;
  }

  private calcWinPercent(
    stats: MatchStatRow[],
    userTeamIds: Set<string>,
    tournamentCtx?: Map<string, { p1TeamId: string | null; p2TeamId: string | null }>,
  ) {
    let wins = 0;
    let played = 0;
    for (const s of stats) {
      if (s.seasonMatch) {
        if (s.seasonMatch.homeScore === null || s.seasonMatch.awayScore === null) continue;
        const teamId = this.resolvePlayerTeamId(s, userTeamIds, tournamentCtx);
        if (!teamId) continue;
        played++;
        const isHome = teamId === s.seasonMatch.homeTeamId;
        const won = isHome
          ? s.seasonMatch.homeScore > s.seasonMatch.awayScore
          : s.seasonMatch.awayScore > s.seasonMatch.homeScore;
        if (won) wins++;
        continue;
      }

      if (s.tournamentMatch) {
        const m = s.tournamentMatch;
        if (m.score1 === null || m.score2 === null) continue;
        const teamId = this.resolvePlayerTeamId(s, userTeamIds, tournamentCtx);
        if (!teamId || !s.tournamentMatchId) continue;
        const ctx = tournamentCtx?.get(s.tournamentMatchId);
        if (!ctx) continue;
        played++;
        const isP1 = teamId === ctx.p1TeamId;
        const won = isP1 ? m.score1 > m.score2 : m.score2 > m.score1;
        if (won) wins++;
      }
    }
    return played > 0 ? Math.round((wins / played) * 1000) / 10 : 0;
  }

  private formatMatchRow(stat: MatchStatRow, category: StatCategoryId) {
    const base = stat.tournamentMatch
      ? {
          matchId: stat.tournamentMatch.id,
          matchUrl: `/tournaments/matches/${stat.tournamentMatch.id}`,
          seasonName: stat.tournamentMatch.tournament.title,
          tournamentName: stat.tournamentMatch.tournament.title,
          opponent: `${stat.tournamentMatch.participant1Name} vs ${stat.tournamentMatch.participant2Name}`,
          score: `${stat.tournamentMatch.score1 ?? '—'}:${stat.tournamentMatch.score2 ?? '—'}`,
          position: stat.positionPlayed,
          positionLabel: POSITION_LABELS[stat.positionPlayed],
          playedAt:
            stat.tournamentMatch.completedAt?.toISOString() ??
            stat.tournamentMatch.scheduledAt?.toISOString() ??
            stat.enteredAt.toISOString(),
          matchRating: xpToMatchRating(stat.xpEarned),
          xpEarned: stat.xpEarned,
        }
      : {
          matchId: stat.seasonMatch!.id,
          matchUrl: `/seasons/matches/${stat.seasonMatch!.id}`,
          seasonName: stat.seasonMatch!.season.name,
          opponent: `[${stat.seasonMatch!.homeTeam.tag}] vs [${stat.seasonMatch!.awayTeam.tag}]`,
          score: `${stat.seasonMatch!.homeScore ?? '—'}:${stat.seasonMatch!.awayScore ?? '—'}`,
          position: stat.positionPlayed,
          positionLabel: POSITION_LABELS[stat.positionPlayed],
          playedAt:
            stat.seasonMatch!.playedAt?.toISOString() ?? stat.enteredAt.toISOString(),
          matchRating: xpToMatchRating(stat.xpEarned),
          xpEarned: stat.xpEarned,
        };

    switch (category) {
      case 'shooting':
        return { ...base, goals: stat.goals, assists: stat.assists };
      case 'passing':
        return { ...base, passAccuracy: stat.passAccuracy, assists: stat.assists };
      case 'movement':
        return { ...base, dribbles: stat.dribbles, fouls: stat.fouls };
      case 'defense':
        return { ...base, tacklesWon: stat.tacklesWon, interceptions: stat.interceptions };
      case 'goalkeeper':
        return { ...base, saves: stat.saves, cleanSheet: stat.cleanSheet };
      default:
        return {
          ...base,
          goals: stat.goals,
          assists: stat.assists,
          passAccuracy: stat.passAccuracy,
          tacklesWon: stat.tacklesWon,
          interceptions: stat.interceptions,
          saves: stat.saves,
        };
    }
  }

  private roleLabel(role: TeamRole | null) {
    switch (role) {
      case TeamRole.OWNER:
        return 'Менеджер';
      case TeamRole.CAPTAIN:
        return 'Капитан';
      case TeamRole.MEMBER:
        return 'Игрок';
      default:
        return 'Игрок';
    }
  }

  private isStale(date: Date) {
    return Date.now() - date.getTime() > 60 * 60 * 1000;
  }
}
