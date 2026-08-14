import { Injectable } from '@nestjs/common';
import { MatchEaSyncStatus, TournamentFormat } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculatePlayerTournamentStat(tournamentId: string, userId: string) {
    const stats = await this.prisma.playerMatchStat.findMany({
      where: { tournamentMatchId: { not: null }, userId, tournamentMatch: { tournamentId } },
    });

    if (stats.length === 0) {
      await this.prisma.playerTournamentStat.deleteMany({ where: { tournamentId, userId } });
      return null;
    }

    const totals = stats.reduce(
      (acc, s) => ({
        goals: acc.goals + s.goals,
        assists: acc.assists + s.assists,
        pass: acc.pass + s.passAccuracy,
        tackles: acc.tackles + s.tacklesWon,
        cleanSheets: acc.cleanSheets + (s.cleanSheet ? 1 : 0),
        xp: acc.xp + s.xpEarned,
      }),
      { goals: 0, assists: 0, pass: 0, tackles: 0, cleanSheets: 0, xp: 0 },
    );

    const n = stats.length;

    return this.prisma.playerTournamentStat.upsert({
      where: { tournamentId_userId: { tournamentId, userId } },
      create: {
        tournamentId,
        userId,
        matchesPlayed: n,
        goals: totals.goals,
        assists: totals.assists,
        passAccuracyPercent: Math.round((totals.pass / n) * 10) / 10,
        tacklesWon: totals.tackles,
        cleanSheets: totals.cleanSheets,
        totalXp: totals.xp,
      },
      update: {
        matchesPlayed: n,
        goals: totals.goals,
        assists: totals.assists,
        passAccuracyPercent: Math.round((totals.pass / n) * 10) / 10,
        tacklesWon: totals.tackles,
        cleanSheets: totals.cleanSheets,
        totalXp: totals.xp,
        updatedAt: new Date(),
      },
    });
  }

  async recalculateTeamTournamentStat(tournamentId: string, teamId: string) {
    const participant = await this.prisma.tournamentParticipant.findUnique({
      where: { tournamentId_teamId: { tournamentId, teamId } },
    });
    if (!participant) return null;

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: 'COMPLETED',
        OR: [{ participant1Id: participant.id }, { participant2Id: participant.id }],
      },
    });

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const m of matches) {
      const isP1 = m.participant1Id === participant.id;
      const gf = isP1 ? (m.score1 ?? 0) : (m.score2 ?? 0);
      const ga = isP1 ? (m.score2 ?? 0) : (m.score1 ?? 0);
      goalsFor += gf;
      goalsAgainst += ga;
      if (gf > ga) wins++;
      else if (gf < ga) losses++;
      else draws++;
    }

    const result = await this.prisma.teamTournamentStat.upsert({
      where: { tournamentId_teamId: { tournamentId, teamId } },
      create: { tournamentId, teamId, wins, draws, losses, goalsFor, goalsAgainst },
      update: { wins, draws, losses, goalsFor, goalsAgainst, updatedAt: new Date() },
    });

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    await Promise.all(members.map((m) => this.refreshMemberPlayerStats(m.userId)));

    return result;
  }

  async getTeamAggregateRecord(teamId: string) {
    const [tournamentStats, seasonEntries] = await Promise.all([
      this.prisma.teamTournamentStat.findMany({ where: { teamId } }),
      this.prisma.seasonTeamEntry.findMany({ where: { teamId } }),
    ]);

    return {
      wins:
        tournamentStats.reduce((sum, row) => sum + row.wins, 0) +
        seasonEntries.reduce((sum, row) => sum + row.wins, 0),
      draws:
        tournamentStats.reduce((sum, row) => sum + row.draws, 0) +
        seasonEntries.reduce((sum, row) => sum + row.draws, 0),
      losses:
        tournamentStats.reduce((sum, row) => sum + row.losses, 0) +
        seasonEntries.reduce((sum, row) => sum + row.losses, 0),
    };
  }

  async getUserTeamAggregateRecord(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);
    if (teamIds.length === 0) {
      return { wins: 0, draws: 0, losses: 0 };
    }

    const [tournamentStats, seasonEntries] = await Promise.all([
      this.prisma.teamTournamentStat.findMany({ where: { teamId: { in: teamIds } } }),
      this.prisma.seasonTeamEntry.findMany({ where: { teamId: { in: teamIds } } }),
    ]);

    return {
      wins:
        tournamentStats.reduce((sum, row) => sum + row.wins, 0) +
        seasonEntries.reduce((sum, row) => sum + row.wins, 0),
      draws:
        tournamentStats.reduce((sum, row) => sum + row.draws, 0) +
        seasonEntries.reduce((sum, row) => sum + row.draws, 0),
      losses:
        tournamentStats.reduce((sum, row) => sum + row.losses, 0) +
        seasonEntries.reduce((sum, row) => sum + row.losses, 0),
    };
  }

  private async getSoloTournamentRecord(userId: string) {
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { userId, teamId: null },
      select: { id: true },
    });
    if (participants.length === 0) {
      return { wins: 0, losses: 0 };
    }

    const participantIds = participants.map((p) => p.id);
    const matches = await this.prisma.match.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { participant1Id: { in: participantIds } },
          { participant2Id: { in: participantIds } },
        ],
      },
    });

    let wins = 0;
    let losses = 0;
    for (const m of matches) {
      const isP1 = participantIds.includes(m.participant1Id!);
      const gf = isP1 ? (m.score1 ?? 0) : (m.score2 ?? 0);
      const ga = isP1 ? (m.score2 ?? 0) : (m.score1 ?? 0);
      if (gf > ga) wins++;
      else if (gf < ga) losses++;
    }

    return { wins, losses };
  }

  async refreshMemberPlayerStats(userId: string) {
    const [teamRecord, soloRecord] = await Promise.all([
      this.getUserTeamAggregateRecord(userId),
      this.getSoloTournamentRecord(userId),
    ]);

    const wins = teamRecord.wins + soloRecord.wins;
    const losses = teamRecord.losses + soloRecord.losses;

    return this.prisma.playerStats.upsert({
      where: { userId },
      create: { userId, wins, losses },
      update: { wins, losses },
    });
  }

  async refreshTeamMembersPlayerStats(teamId: string) {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    await Promise.all(members.map((m) => this.refreshMemberPlayerStats(m.userId)));
  }

  async recalculateAfterTournamentMatchImport(
    tournamentId: string,
    userIds: string[],
    teamIds: string[],
  ) {
    await Promise.all([
      ...userIds.map((userId) => this.recalculatePlayerTournamentStat(tournamentId, userId)),
      ...teamIds.map((teamId) => this.recalculateTeamTournamentStat(tournamentId, teamId)),
    ]);
  }

  async getTeamTournamentStats(teamId: string) {
    return this.prisma.teamTournamentStat.findMany({
      where: { teamId },
      include: { tournament: { select: { id: true, slug: true, title: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPlayerTournamentStats(userId: string) {
    return this.prisma.playerTournamentStat.findMany({
      where: { userId },
      include: { tournament: { select: { id: true, slug: true, title: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async maybeGenerateFinalFromRoundRobin(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.format !== TournamentFormat.ROUND_ROBIN) return;

    const pendingGroup = await this.prisma.match.count({
      where: {
        tournamentId,
        round: 1,
        status: { notIn: ['COMPLETED', 'BYE', 'CANCELLED'] },
      },
    });
    if (pendingGroup > 0) return;

    const existingFinal = await this.prisma.match.findFirst({
      where: { tournamentId, round: 2 },
    });
    if (existingFinal) return;

    const teamStats = await this.prisma.teamTournamentStat.findMany({
      where: { tournamentId },
    });

    const ranked = teamStats
      .map((s) => ({
        ...s,
        points: s.wins * 3 + s.draws,
        goalDifference: s.goalsFor - s.goalsAgainst,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      })
      .slice(0, 2);

    if (ranked.length < 2) return;

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, teamId: { in: ranked.map((s) => s.teamId) } },
      include: { team: { select: { name: true } } },
    });
    const byTeam = new Map(participants.map((p) => [p.teamId!, p]));
    const top = ranked.map((s) => byTeam.get(s.teamId)).filter(Boolean);
    if (top.length < 2) return;

    await this.prisma.match.create({
      data: {
        tournamentId,
        round: 2,
        position: 0,
        participant1Id: top[0]!.id,
        participant2Id: top[1]!.id,
        participant1Name: top[0]!.team?.name ?? 'Team 1',
        participant2Name: top[1]!.team?.name ?? 'Team 2',
        status: 'SCHEDULED',
        scheduledAt: new Date(),
        eaSyncStatus: MatchEaSyncStatus.AWAITING_EA,
      },
    });
  }
}
