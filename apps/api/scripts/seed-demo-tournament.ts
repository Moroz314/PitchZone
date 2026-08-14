/**
 * Демо-турнир Round Robin 4×2 с частично сыгранным групповым этапом.
 * Можно удалить через UI организатора или: npm run seed:demo-tournament -- --cleanup
 *
 * Run: npm run seed:demo-tournament
 */
import {
  GameTitle,
  MatchFormat,
  MatchStatus,
  ParticipantType,
  PaymentStatus,
  PlayerPosition,
  Team,
  TournamentFormat,
  TournamentParticipant,
  TournamentStatus,
  TournamentVisibility,
} from '@prisma/client';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BracketService } from '../src/tournaments/bracket.service';
import { TournamentStatsService } from '../src/stats/tournament-stats.service';

export const DEMO_TOURNAMENT_SLUG = 'demo-rr-preview';

const DEMO_TEAMS = [
  { tag: 'DEM1', name: 'Demo Alpha' },
  { tag: 'DEM2', name: 'Demo Beta' },
  { tag: 'DEM3', name: 'Demo Gamma' },
  { tag: 'DEM4', name: 'Demo Delta' },
] as const;

/** [p1Tag, p2Tag, score1, score2] — теги команд DEM1..DEM4 */
const GROUP_RESULTS: [string, string, number, number][] = [
  ['DEM1', 'DEM2', 3, 1],
  ['DEM1', 'DEM3', 2, 2],
  ['DEM1', 'DEM4', 4, 0],
  ['DEM2', 'DEM3', 1, 2],
  ['DEM2', 'DEM4', 3, 1],
];

async function cleanupDemo(prisma: PrismaService) {
  const existing = await prisma.tournament.findUnique({ where: { slug: DEMO_TOURNAMENT_SLUG } });
  if (existing) {
    await prisma.playerMatchStat.deleteMany({
      where: { tournamentMatch: { tournamentId: existing.id } },
    });
    await prisma.playerTournamentStat.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.teamTournamentStat.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.match.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.tournament.delete({ where: { id: existing.id } });
    console.log(`Удалён турнир /tournaments/${DEMO_TOURNAMENT_SLUG}`);
  }
}

async function main() {
  const cleanupOnly = process.argv.includes('--cleanup');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);

    if (cleanupOnly) {
      await cleanupDemo(prisma);
      return;
    }

    const bracketService = app.get(BracketService);
    const tournamentStats = app.get(TournamentStatsService);

    const admin = await prisma.user.findUnique({ where: { email: 'admin@pitchzone.gg' } });
    if (!admin) throw new Error('admin@pitchzone.gg не найден — выполните npm run db:seed');

    await cleanupDemo(prisma);

    const teams: Team[] = [];
    for (const spec of DEMO_TEAMS) {
      const team = await prisma.team.upsert({
        where: { tag: spec.tag },
        update: { name: spec.name },
        create: {
          name: spec.name,
          tag: spec.tag,
          country: 'Россия',
          countryCode: 'RU',
          description: 'Демо-команда для превью турнира',
          ownerId: admin.id,
          members: {
            create: [{ userId: admin.id, role: 'OWNER' }],
          },
        },
      });
      teams.push(team);
    }

    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 7);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);

    const tournament = await prisma.tournament.create({
      data: {
        slug: DEMO_TOURNAMENT_SLUG,
        title: 'Демо: Round Robin 4×2',
        description:
          'Тестовый турнир для превью таблицы и статистики. Можно удалить в панели организатора.',
        game: GameTitle.EA_FC,
        format: TournamentFormat.ROUND_ROBIN,
        matchFormat: MatchFormat.BO1,
        teamSize: 2,
        status: TournamentStatus.REGISTRATION_CLOSED,
        entryFee: 0,
        maxParticipants: 4,
        minParticipants: 4,
        registrationDeadline: deadline,
        rulesText:
          'Демо-регламент. Группа Round Robin, финал Bo3. Победа — 3 очка, ничья — 1, поражение — 0.',
        visibility: TournamentVisibility.PUBLIC,
        startsAt,
        bannerGradient: 'from-accent/20 via-accent-cyan/10 to-transparent',
        organizerId: admin.id,
      },
    });

    const tagToTeam = new Map(teams.map((t) => [t.tag, t]));
    const participants: TournamentParticipant[] = [];

    for (const [i, team] of teams.entries()) {
      const p = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          teamId: team.id,
          type: ParticipantType.TEAM,
          seed: i + 1,
          paymentStatus: PaymentStatus.PAID,
        },
      });
      participants.push(p);
    }

    const partByTeamId = new Map(participants.map((p) => [p.teamId!, p]));

    await bracketService.generateBracket(tournament.id, TournamentFormat.ROUND_ROBIN);
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.LIVE },
    });

    const matches = await prisma.match.findMany({
      where: { tournamentId: tournament.id, round: 1 },
      orderBy: { position: 'asc' },
    });

    const findMatch = (tag1: string, tag2: string) => {
      const t1 = tagToTeam.get(tag1)!;
      const t2 = tagToTeam.get(tag2)!;
      const p1 = partByTeamId.get(t1.id)!;
      const p2 = partByTeamId.get(t2.id)!;
      return matches.find(
        (m) =>
          (m.participant1Id === p1.id && m.participant2Id === p2.id) ||
          (m.participant1Id === p2.id && m.participant2Id === p1.id),
      );
    };

    let firstCompletedMatchId: string | null = null;

    for (const [tag1, tag2, s1, s2] of GROUP_RESULTS) {
      const match = findMatch(tag1, tag2);
      if (!match) throw new Error(`Матч ${tag1} vs ${tag2} не найден`);

      const p1Team = tagToTeam.get(tag1)!;
      const score1 = match.participant1Id === partByTeamId.get(p1Team.id)!.id ? s1 : s2;
      const score2 = match.participant1Id === partByTeamId.get(p1Team.id)!.id ? s2 : s1;

      if (score1 === score2) {
        await prisma.match.update({
          where: { id: match.id },
          data: {
            score1,
            score2,
            winnerId: null,
            status: MatchStatus.COMPLETED,
            isActive: false,
            completedAt: new Date(),
            eaSyncStatus: 'MANUAL',
            eaSyncNote: 'Демо: ничья',
          },
        });
      } else {
        await bracketService.updateMatchResult(match.id, score1, score2);
      }

      if (!firstCompletedMatchId) firstCompletedMatchId = match.id;

      for (const teamId of [tagToTeam.get(tag1)!.id, tagToTeam.get(tag2)!.id]) {
        await tournamentStats.recalculateTeamTournamentStat(tournament.id, teamId);
      }
    }

    if (firstCompletedMatchId) {
      await prisma.playerMatchStat.deleteMany({ where: { tournamentMatchId: firstCompletedMatchId } });
      const demoPlayers = await prisma.user.findMany({
        where: {
          email: {
            in: ['admin@pitchzone.gg', 'pitch@pitchzone.gg', 'neon@pitchzone.gg'],
          },
        },
        take: 4,
      });
      const statRows = [
        { goals: 2, assists: 1, rating: 8.4 },
        { goals: 1, assists: 0, rating: 7.2 },
        { goals: 0, assists: 1, rating: 6.8 },
        { goals: 0, assists: 0, rating: 6.1 },
      ];
      for (let i = 0; i < Math.min(demoPlayers.length, statRows.length); i++) {
        const row = statRows[i]!;
        await prisma.playerMatchStat.create({
          data: {
            tournamentMatchId: firstCompletedMatchId,
            userId: demoPlayers[i]!.id,
            positionPlayed: PlayerPosition.ST,
            passAccuracy: 82,
            dribbles: 3,
            tacklesWon: 2,
            goals: row.goals,
            assists: row.assists,
            saves: 0,
            xpEarned: Math.round(row.rating * 10),
            enteredById: admin.id,
            otherMetrics: { rating: row.rating, minutesPlayed: 90 },
          },
        });
        await tournamentStats.recalculatePlayerTournamentStat(tournament.id, demoPlayers[i]!.id);
      }
    }

    const table = await prisma.teamTournamentStat.findMany({
      where: { tournamentId: tournament.id },
      include: { team: { select: { tag: true, name: true } } },
    });

    console.log('\n✅ Демо-турнир создан\n');
    console.log(`   Страница: http://localhost:3000/tournaments/${DEMO_TOURNAMENT_SLUG}`);
    console.log(`   Организатор: admin@pitchzone.gg / demo12345`);
    console.log(`   Статус: LIVE, сыграно ${GROUP_RESULTS.length}/6 матчей группы\n`);
    console.log('   Таблица (очки = W×3 + D×1):');
    for (const row of table.sort((a, b) => b.wins * 3 + b.draws - (a.wins * 3 + a.draws))) {
      console.log(
        `   ${row.team.tag} ${row.team.name}: ${row.wins}W ${row.draws}D ${row.losses}L ${row.goalsFor}:${row.goalsAgainst}`,
      );
    }
    console.log('\n   Удалить: панель организатора → «Удалить турнир»');
    console.log('   Или: npm run seed:demo-tournament -- --cleanup\n');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
