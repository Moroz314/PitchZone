/**
 * Sandbox replica of ACF "Last Dance 2026" (tournament/1288) for internal testing.
 * Run: npm run seed:last-dance
 */
import {
  AuthProvider,
  DivisionTier,
  PrismaClient,
  SeasonMatchStatus,
  SeasonStatus,
  SeasonType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  EA_LAST_DANCE_MATCH_ID,
  ensureEaDemoRoster,
  resetEaMatchForPoll,
} from './seed-ea-demo-roster';
import { ensureLdG7Rosters, LD_G7_MATCH_ID, LD_G7_PLAYED_AT } from './seed-ld-g7-rosters';

const prisma = new PrismaClient();

const SEASON_ID = 'demo-last-dance-2026';

type TeamSeed = {
  name: string;
  tag: string;
  points?: number;
  matchesPlayed?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  eaClubId?: string;
};

type DivisionSeed = {
  id: string;
  tier: DivisionTier;
  groupLabel: string;
  tierOrder: number;
};

const DIVISIONS: DivisionSeed[] = [
  { id: 'ld26-div-gold-1', tier: DivisionTier.GOLD, groupLabel: 'Golden лига — Группа 1', tierOrder: 1 },
  { id: 'ld26-div-gold-2', tier: DivisionTier.GOLD, groupLabel: 'Golden лига — Группа 2', tierOrder: 2 },
  { id: 'ld26-div-gold-3', tier: DivisionTier.GOLD, groupLabel: 'Golden лига — Группа 3', tierOrder: 3 },
  { id: 'ld26-div-silver', tier: DivisionTier.SILVER, groupLabel: 'Silver лига', tierOrder: 4 },
  { id: 'ld26-div-silver-g1', tier: DivisionTier.SILVER, groupLabel: 'Групповой этап — 1', tierOrder: 5 },
  {
    id: 'ld26-div-silver-qual',
    tier: DivisionTier.SILVER,
    groupLabel: 'Silver лига — квалификация',
    tierOrder: 6,
  },
];

const GOLD_GROUP_1: TeamSeed[] = [
  { name: 'Nemesis', tag: 'NEMS', points: 18, matchesPlayed: 6, wins: 6, losses: 0, goalsFor: 23, goalsAgainst: 11 },
  { name: 'Krasnodar eSports', tag: 'KRES', points: 15, matchesPlayed: 6, wins: 5, losses: 1, goalsFor: 19, goalsAgainst: 12 },
  { name: 'Darkside eSports', tag: 'DRKS', points: 15, matchesPlayed: 6, wins: 5, losses: 1, goalsFor: 18, goalsAgainst: 10 },
  { name: 'Ponedelnik', tag: 'PNDK', points: 15, matchesPlayed: 6, wins: 5, losses: 1, goalsFor: 16, goalsAgainst: 11 },
  { name: 'DRAL GAMING', tag: 'DRAL', points: 9, matchesPlayed: 6, wins: 3, losses: 3, goalsFor: 14, goalsAgainst: 15 },
  { name: 'Level Pro', tag: 'LVPR', points: 6, matchesPlayed: 6, wins: 2, losses: 4, goalsFor: 10, goalsAgainst: 14, eaClubId: '7204' },
  { name: '2GARIN', tag: '2GAR', points: 6, matchesPlayed: 6, wins: 2, losses: 4, goalsFor: 9, goalsAgainst: 13 },
  { name: 'CHARISMA', tag: 'CHRS', points: 3, matchesPlayed: 6, wins: 1, losses: 5, goalsFor: 8, goalsAgainst: 16 },
  { name: 'ULTRAS', tag: 'ULTR', points: 3, matchesPlayed: 6, wins: 1, losses: 5, goalsFor: 7, goalsAgainst: 18, eaClubId: '4372453' },
  { name: 'FC STIMUL', tag: 'STIM', points: 0, matchesPlayed: 6, wins: 0, losses: 6, goalsFor: 5, goalsAgainst: 20 },
];

const GOLD_GROUP_2: TeamSeed[] = [
  { name: 'GG Union', tag: 'GGUN', points: 16, matchesPlayed: 6, wins: 5, losses: 1, goalsFor: 20, goalsAgainst: 11 },
  { name: 'Rampage', tag: 'RMPG', points: 13, matchesPlayed: 6, wins: 4, losses: 2, goalsFor: 17, goalsAgainst: 13 },
  { name: 'LKN', tag: 'LKNX', points: 12, matchesPlayed: 6, wins: 4, losses: 2, goalsFor: 15, goalsAgainst: 12 },
  { name: 'Bandits', tag: 'BNDT', points: 10, matchesPlayed: 6, wins: 3, losses: 3, goalsFor: 14, goalsAgainst: 14 },
  { name: 'DeS eSports', tag: 'DESX', points: 9, matchesPlayed: 6, wins: 3, losses: 3, goalsFor: 12, goalsAgainst: 13 },
  { name: 'Old School', tag: 'OLDS', points: 7, matchesPlayed: 6, wins: 2, losses: 4, goalsFor: 11, goalsAgainst: 15 },
  { name: 'EYES FC', tag: 'EYES', points: 6, matchesPlayed: 6, wins: 2, losses: 4, goalsFor: 10, goalsAgainst: 16 },
  { name: 'Night Wolves', tag: 'NWLV', points: 4, matchesPlayed: 6, wins: 1, losses: 5, goalsFor: 9, goalsAgainst: 17 },
  { name: 'Pro Clubs UA', tag: 'PCUA', points: 3, matchesPlayed: 6, wins: 1, losses: 5, goalsFor: 8, goalsAgainst: 18 },
  { name: 'Mix Team', tag: 'MIXT', points: 0, matchesPlayed: 6, wins: 0, losses: 6, goalsFor: 6, goalsAgainst: 21 },
];

const GOLD_GROUP_3: TeamSeed[] = [
  { name: 'Zenit eSports', tag: 'ZNIT', points: 17, matchesPlayed: 6, wins: 5, losses: 1, goalsFor: 21, goalsAgainst: 10 },
  { name: 'CSKA Pro', tag: 'CSKA', points: 14, matchesPlayed: 6, wins: 4, losses: 2, goalsFor: 18, goalsAgainst: 12 },
  { name: 'Lokomotiv FC', tag: 'LOKT', points: 13, matchesPlayed: 6, wins: 4, losses: 2, goalsFor: 16, goalsAgainst: 11 },
  { name: 'Rubin eSports', tag: 'RUBN', points: 10, matchesPlayed: 6, wins: 3, losses: 3, goalsFor: 13, goalsAgainst: 14 },
  { name: 'Akron FC', tag: 'AKRN', points: 9, matchesPlayed: 6, wins: 3, losses: 3, goalsFor: 12, goalsAgainst: 13 },
  { name: 'Sochi Pro', tag: 'SOCH', points: 7, matchesPlayed: 6, wins: 2, losses: 4, goalsFor: 11, goalsAgainst: 15 },
  { name: 'Baltika FC', tag: 'BLTK', points: 6, matchesPlayed: 6, wins: 2, losses: 4, goalsFor: 10, goalsAgainst: 14 },
  { name: 'Fakel eSports', tag: 'FAKL', points: 4, matchesPlayed: 6, wins: 1, losses: 5, goalsFor: 9, goalsAgainst: 17 },
  { name: 'Ural FC', tag: 'URAL', points: 3, matchesPlayed: 6, wins: 1, losses: 5, goalsFor: 8, goalsAgainst: 18 },
  { name: 'Torpedo eSports', tag: 'TRPD', points: 0, matchesPlayed: 6, wins: 0, losses: 6, goalsFor: 5, goalsAgainst: 22 },
];

const SILVER_LEAGUE: TeamSeed[] = [
  { name: 'One Season', tag: 'ONES', points: 14, matchesPlayed: 5, wins: 4, losses: 1, goalsFor: 16, goalsAgainst: 9 },
  { name: 'IMUST', tag: 'IMUS', points: 12, matchesPlayed: 5, wins: 4, losses: 1, goalsFor: 14, goalsAgainst: 10 },
  { name: 'FC Revival', tag: 'REVI', points: 10, matchesPlayed: 5, wins: 3, losses: 2, goalsFor: 12, goalsAgainst: 11 },
  { name: 'AC SPARTAN', tag: 'SPAR', points: 9, matchesPlayed: 5, wins: 3, losses: 2, goalsFor: 11, goalsAgainst: 10 },
  { name: 'Neftchi eSports', tag: 'NEFT', points: 6, matchesPlayed: 5, wins: 2, losses: 3, goalsFor: 10, goalsAgainst: 12 },
  { name: 'SHMAROVOZ', tag: 'SHMR', points: 6, matchesPlayed: 5, wins: 2, losses: 3, goalsFor: 9, goalsAgainst: 13 },
  { name: 'FC STAKANOV', tag: 'STKN', points: 3, matchesPlayed: 5, wins: 1, losses: 4, goalsFor: 8, goalsAgainst: 14 },
  { name: 'AD Patres', tag: 'ADPT', points: 0, matchesPlayed: 5, wins: 0, losses: 5, goalsFor: 5, goalsAgainst: 16 },
  { name: 'FC Rostov Pro', tag: 'ROST', points: 0, matchesPlayed: 5, wins: 0, losses: 5, goalsFor: 3, goalsAgainst: 17 },
  { name: 'Samara United', tag: 'SMRU', points: 0, matchesPlayed: 5, wins: 0, losses: 5, goalsFor: 2, goalsAgainst: 18 },
];

const SILVER_GROUP_STAGE: TeamSeed[] = [
  { name: 'VFC Dobro', tag: 'VFCD', points: 8, matchesPlayed: 4, wins: 2, losses: 2, goalsFor: 10, goalsAgainst: 10 },
  { name: 'Amity', tag: 'AMTY', points: 10, matchesPlayed: 4, wins: 3, losses: 1, goalsFor: 12, goalsAgainst: 8, eaClubId: '66373' },
  { name: 'No Hope', tag: 'NHOP', points: 9, matchesPlayed: 4, wins: 3, losses: 1, goalsFor: 11, goalsAgainst: 9, eaClubId: '7674' },
  { name: 'FC DYSHNO', tag: 'DYSH', points: 7, matchesPlayed: 4, wins: 2, losses: 2, goalsFor: 10, goalsAgainst: 10 },
  { name: 'Krasnodar II', tag: 'KR2', points: 6, matchesPlayed: 4, wins: 2, losses: 2, goalsFor: 9, goalsAgainst: 9 },
  { name: 'Darkside II', tag: 'DRK2', points: 6, matchesPlayed: 4, wins: 2, losses: 2, goalsFor: 8, goalsAgainst: 10 },
  { name: 'Ponedelnik II', tag: 'PND2', points: 4, matchesPlayed: 4, wins: 1, losses: 3, goalsFor: 7, goalsAgainst: 11 },
  { name: 'Level Pro II', tag: 'LVP2', points: 3, matchesPlayed: 4, wins: 1, losses: 3, goalsFor: 6, goalsAgainst: 12 },
  { name: 'Charisma II', tag: 'CHR2', points: 3, matchesPlayed: 4, wins: 1, losses: 3, goalsFor: 5, goalsAgainst: 13 },
  { name: 'Ultras II', tag: 'ULT2', points: 0, matchesPlayed: 4, wins: 0, losses: 4, goalsFor: 4, goalsAgainst: 14 },
];

const SILVER_QUALIFICATION: TeamSeed[] = [
  { name: 'FC Dynamo eSports', tag: 'DYNM', points: 12, matchesPlayed: 4, wins: 4, losses: 0, goalsFor: 15, goalsAgainst: 5 },
  { name: 'SKA Pro Clubs', tag: 'SKAP', points: 9, matchesPlayed: 4, wins: 3, losses: 1, goalsFor: 12, goalsAgainst: 7 },
  { name: 'Rotor FC', tag: 'ROTR', points: 6, matchesPlayed: 4, wins: 2, losses: 2, goalsFor: 10, goalsAgainst: 9 },
  { name: 'KAMAZ eSports', tag: 'KAMZ', points: 6, matchesPlayed: 4, wins: 2, losses: 2, goalsFor: 9, goalsAgainst: 10 },
  { name: 'Chernomorets', tag: 'CHRN', points: 3, matchesPlayed: 4, wins: 1, losses: 3, goalsFor: 8, goalsAgainst: 11 },
  { name: 'Volgar FC', tag: 'VLGR', points: 3, matchesPlayed: 4, wins: 1, losses: 3, goalsFor: 7, goalsAgainst: 12 },
  { name: 'Alania Pro', tag: 'ALAN', points: 0, matchesPlayed: 4, wins: 0, losses: 4, goalsFor: 5, goalsAgainst: 14 },
  { name: 'Tyumen FC', tag: 'TYMN', points: 0, matchesPlayed: 4, wins: 0, losses: 4, goalsFor: 4, goalsAgainst: 15 },
  { name: 'Chelyabinsk FC', tag: 'CHLB', points: 0, matchesPlayed: 4, wins: 0, losses: 4, goalsFor: 3, goalsAgainst: 16 },
  { name: 'Ufa Pro Clubs', tag: 'UFAP', points: 0, matchesPlayed: 4, wins: 0, losses: 4, goalsFor: 2, goalsAgainst: 17 },
];

const DIVISION_TEAMS: Record<string, TeamSeed[]> = {
  'ld26-div-gold-1': GOLD_GROUP_1,
  'ld26-div-gold-2': GOLD_GROUP_2,
  'ld26-div-gold-3': GOLD_GROUP_3,
  'ld26-div-silver': SILVER_LEAGUE,
  'ld26-div-silver-g1': SILVER_GROUP_STAGE,
  'ld26-div-silver-qual': SILVER_QUALIFICATION,
};

type FixtureSeed = {
  id: string;
  divisionId: string;
  round: number;
  weekLabel: string;
  homeTag: string;
  awayTag: string;
  playedAt: string;
};

const FIXTURES: FixtureSeed[] = [
  { id: 'ld-g7-ultr-lvpr', divisionId: 'ld26-div-gold-1', round: 7, weekLabel: 'Golden лига · Тур 7', homeTag: 'ULTR', awayTag: 'LVPR', playedAt: LD_G7_PLAYED_AT },
  { id: 'ld-g7-drks-kres', divisionId: 'ld26-div-gold-1', round: 7, weekLabel: 'Тур 7', homeTag: 'DRKS', awayTag: 'KRES', playedAt: '2026-08-12T19:15:00.000Z' },
  { id: 'ld-g7-nems-pndk', divisionId: 'ld26-div-gold-1', round: 7, weekLabel: 'Тур 7', homeTag: 'NEMS', awayTag: 'PNDK', playedAt: '2026-08-12T19:15:00.000Z' },
  { id: 'ld-s5-vfcd-amty', divisionId: 'ld26-div-silver-g1', round: 5, weekLabel: 'Тур 5', homeTag: 'VFCD', awayTag: 'AMTY', playedAt: '2026-08-12T19:30:00.000Z' },
  { id: 'ld-s5-dysh-nhop', divisionId: 'ld26-div-silver-g1', round: 5, weekLabel: 'Тур 5', homeTag: 'DYSH', awayTag: 'NHOP', playedAt: '2026-08-12T19:30:00.000Z' },
  {
    id: 'ld-ea-nhop-amty',
    divisionId: 'ld26-div-silver-g1',
    round: 5,
    weekLabel: 'Тур 5 · EA Sync',
    homeTag: 'NHOP',
    awayTag: 'AMTY',
    playedAt: '2026-08-11T20:12:41.000Z',
  },
  { id: 'ld-s5-stkn-adpt', divisionId: 'ld26-div-silver', round: 5, weekLabel: 'Тур 5', homeTag: 'STKN', awayTag: 'ADPT', playedAt: '2026-08-12T19:30:00.000Z' },
  { id: 'ld-s5-neft-shmr', divisionId: 'ld26-div-silver', round: 5, weekLabel: 'Тур 5', homeTag: 'NEFT', awayTag: 'SHMR', playedAt: '2026-08-12T19:30:00.000Z' },
  { id: 'ld-s5-spar-ones', divisionId: 'ld26-div-silver', round: 5, weekLabel: 'Тур 5', homeTag: 'SPAR', awayTag: 'ONES', playedAt: '2026-08-12T19:30:00.000Z' },
  { id: 'ld-s5-imus-revi', divisionId: 'ld26-div-silver', round: 5, weekLabel: 'Тур 5', homeTag: 'IMUS', awayTag: 'REVI', playedAt: '2026-08-12T19:30:00.000Z' },
];

async function resolveManagerId() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@pitchzone.gg' },
    select: { id: true },
  });
  if (admin) return admin.id;

  const passwordHash = await bcrypt.hash('demo12345', 12);
  const created = await prisma.user.create({
    data: {
      email: 'sandbox@pitchzone.gg',
      passwordHash,
      role: UserRole.ADMIN,
      profile: { create: { nickname: 'SandboxAdmin', country: 'Россия', countryCode: 'RU' } },
      stats: { create: {} },
      accounts: { create: { provider: AuthProvider.EMAIL, providerAccountId: 'sandbox@pitchzone.gg' } },
    },
  });
  return created.id;
}

async function upsertTeam(seed: TeamSeed, ownerId: string) {
  return prisma.team.upsert({
    where: { tag: seed.tag },
    update: { name: seed.name, description: 'Last Dance 2026 — sandbox (внутренний тест)' },
    create: {
      name: seed.name,
      tag: seed.tag,
      country: 'Россия',
      countryCode: 'RU',
      description: 'Last Dance 2026 — sandbox (внутренний тест)',
      ownerId,
    },
  });
}

async function main() {
  const managerId = await resolveManagerId();
  const teamIds = new Map<string, string>();

  const season = await prisma.season.upsert({
    where: { id: SEASON_ID },
    create: {
      id: SEASON_ID,
      name: 'Last Dance 2026',
      type: SeasonType.REGULAR,
      year: 2026,
      calendarSlot: 'SUMMER',
      startDate: new Date('2026-07-28'),
      endDate: new Date('2026-08-27'),
      status: SeasonStatus.ACTIVE,
      hasDivisions: true,
      entryFee: 0,
      lanPointsWeight: 0,
      isPublic: false,
    },
    update: {
      name: 'Last Dance 2026',
      status: SeasonStatus.ACTIVE,
      hasDivisions: true,
      isPublic: false,
    },
  });

  const divisionIds = new Map<string, string>();

  for (const div of DIVISIONS) {
    const record = await prisma.division.upsert({
      where: { id: div.id },
      create: {
        id: div.id,
        seasonId: season.id,
        name: div.tier,
        groupLabel: div.groupLabel,
        tierOrder: div.tierOrder,
      },
      update: {
        seasonId: season.id,
        name: div.tier,
        groupLabel: div.groupLabel,
        tierOrder: div.tierOrder,
      },
    });
    divisionIds.set(div.id, record.id);

    await prisma.promotionRelegationRule.upsert({
      where: { seasonId_divisionId: { seasonId: season.id, divisionId: record.id } },
      create: {
        seasonId: season.id,
        divisionId: record.id,
        promoteTopN: div.tier === DivisionTier.SILVER && div.groupLabel.includes('квалификация') ? 2 : 0,
        relegateBottomN: div.tier === DivisionTier.GOLD ? 2 : 0,
      },
      update: {},
    });
  }

  // Remove legacy 2-division setup if present
  await prisma.division.deleteMany({
    where: {
      seasonId: season.id,
      id: { notIn: DIVISIONS.map((d) => d.id) },
    },
  });

  let teamCount = 0;
  for (const [divId, teams] of Object.entries(DIVISION_TEAMS)) {
    const divisionId = divisionIds.get(divId)!;
    for (const seed of teams) {
      const team = await upsertTeam(seed, managerId);
      teamIds.set(seed.tag, team.id);
      teamCount++;

      await prisma.seasonTeamEntry.upsert({
        where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
        create: {
          seasonId: season.id,
          divisionId,
          teamId: team.id,
          managerId,
          points: seed.points ?? 0,
          matchesPlayed: seed.matchesPlayed ?? 0,
          wins: seed.wins ?? 0,
          draws: seed.draws ?? 0,
          losses: seed.losses ?? 0,
          goalsFor: seed.goalsFor ?? 0,
          goalsAgainst: seed.goalsAgainst ?? 0,
        },
        update: {
          divisionId,
          points: seed.points ?? 0,
          matchesPlayed: seed.matchesPlayed ?? 0,
          wins: seed.wins ?? 0,
          draws: seed.draws ?? 0,
          losses: seed.losses ?? 0,
          goalsFor: seed.goalsFor ?? 0,
          goalsAgainst: seed.goalsAgainst ?? 0,
        },
      });

      if (seed.eaClubId) {
        await prisma.eaClubLink.upsert({
          where: { teamId: team.id },
          create: { teamId: team.id, eaClubId: seed.eaClubId, platform: 'PS' },
          update: { eaClubId: seed.eaClubId },
        });
      }
    }
  }

  for (const fx of FIXTURES) {
    const homeTeamId = teamIds.get(fx.homeTag);
    const awayTeamId = teamIds.get(fx.awayTag);
    if (!homeTeamId || !awayTeamId) continue;

    await prisma.seasonMatch.upsert({
      where: { id: fx.id },
      create: {
        id: fx.id,
        seasonId: season.id,
        divisionId: fx.divisionId,
        roundNumber: fx.round,
        weekLabel: fx.weekLabel,
        homeTeamId,
        awayTeamId,
        status: SeasonMatchStatus.SCHEDULED,
        playedAt: new Date(fx.playedAt),
      },
      update: {
        divisionId: fx.divisionId,
        homeTeamId,
        awayTeamId,
        playedAt: new Date(fx.playedAt),
        ...(fx.id === EA_LAST_DANCE_MATCH_ID || fx.id === LD_G7_MATCH_ID
          ? {
              eaMatchId: null,
              homeScore: null,
              awayScore: null,
              status: SeasonMatchStatus.SCHEDULED,
            }
          : {}),
      },
    });
  }

  await ensureEaDemoRoster(prisma);
  await ensureLdG7Rosters(prisma);

  // Avoid EA matcher picking two fixtures for the same real match (demo-season-ea vs Last Dance)
  await prisma.playerMatchStat.deleteMany({ where: { seasonMatchId: 'demo-ea-match-nhope-amity' } });
  await prisma.seasonMatch.deleteMany({ where: { id: 'demo-ea-match-nhope-amity' } });
  await resetEaMatchForPoll(prisma, EA_LAST_DANCE_MATCH_ID);
  await resetEaMatchForPoll(prisma, LD_G7_MATCH_ID);

  console.log('Last Dance sandbox seeded (hidden from public /seasons):');
  console.log(`  Season: ${season.id} · isPublic=false`);
  console.log(`  Direct link: /seasons/${season.id}`);
  console.log(`  Admin: /admin/seasons`);
  console.log(`  Divisions: ${DIVISIONS.length} (Golden×3 + Silver×3)`);
  console.log(`  Teams: ${teamCount}`);
  console.log(`  Fixtures: ${FIXTURES.length} (incl. EA: ${EA_LAST_DANCE_MATCH_ID})`);
  console.log(`  EA poll G7: npm run seed:ld-g7-poll`);
  console.log(`  Match G7: /seasons/matches/${LD_G7_MATCH_ID}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
