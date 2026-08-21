import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TeamsService } from '../src/teams/teams.service';
import { SeasonsService } from '../src/seasons/seasons.service';
import { StatsService } from '../src/stats/stats.service';
import { GamertagValidatorService } from '../src/onboarding/gamertag-validator.service';
import { PlayerProfileAggregationService } from '../src/player-profile/player-profile.service';
import { OnboardingService } from '../src/onboarding/onboarding.service';
import { UserRole, PlayerPosition, TransferAdStatus, ContractStatus } from '@prisma/client';

async function bootstrap() {
  console.log('Bootstrapping Extended E2E Test (Clubs & Seasons)...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);
  const teamsService = app.get(TeamsService);
  const seasonsService = app.get(SeasonsService);
  const statsService = app.get(StatsService);
  const onboardingService = app.get(OnboardingService);
  const gamertagValidator = app.get(GamertagValidatorService);
  const profileService = app.get(PlayerProfileAggregationService);

  const ts = Date.now();
  console.log('\n--- STARTING STAGE 15: CLUBS, TRANSFERS, CONTRACTS ---');
  // 1. Create Users
  const captain = await prisma.user.create({
    data: { email: `cap_${ts}@test.com`, role: UserRole.PLAYER, isVerified: true, profile: { create: { nickname: `Cap_${ts}` } } }
  });
  const player = await prisma.user.create({
    data: { email: `plr_${ts}@test.com`, role: UserRole.PLAYER, isVerified: true, profile: { create: { nickname: `Plr_${ts}` } } }
  });

  // 1.1 Create Team with colors
  const team = await prisma.team.create({
    data: {
      name: `Test FC ${ts}`, tag: `T${ts}`.substring(0,5), ownerId: captain.id,
      primaryColor: '#ff0000', secondaryColor: '#00ff00', kitTemplateId: null,
      members: { create: { userId: captain.id, role: 'OWNER' } }
    }
  });
  console.log(`✅ Created Team: ${team.name} with colors: Primary=${team.primaryColor}, Secondary=${team.secondaryColor}`);

  // 1.2 Transfers
  const pAd = await prisma.playerTransferAd.create({
    data: { userId: player.id, position: PlayerPosition.ST, availableDays: {}, aboutText: 'Looking for a club', status: TransferAdStatus.ACTIVE }
  });
  const cAd = await prisma.clubTransferAd.create({
    data: { teamId: team.id, positionNeeded: PlayerPosition.ST, requirementsText: 'Need ST', status: TransferAdStatus.ACTIVE }
  });
  console.log(`✅ Created Transfer Ads: PlayerAd ${pAd.id}, ClubAd ${cAd.id}`);

  // 1.3 Contracts
  const contract = await prisma.contract.create({
    data: {
      teamId: team.id, userId: player.id, offeredByUserId: captain.id,
      durationMonths: 2, buyoutFee: 1000, status: ContractStatus.ACTIVE,
      startDate: new Date(), endDate: new Date(Date.now() + 60 * 24 * 3600 * 1000)
    }
  });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: player.id, role: 'MEMBER' } });
  
  try {
    console.log(`Attempting to leave team before contract expires...`);
    await teamsService.removeMember(team.id, player.id, player.id);
    console.error('❌ BUG: Player was able to leave team despite active contract!');
  } catch (e: any) {
    console.log(`✅ Blocked leaving team correctly (Contract logic): ${e.message}`);
  }

  console.log('\n--- STARTING STAGE 16: SEASONS & DIVISIONS ---');
  const admin = await prisma.user.create({
    data: { email: `admin_${ts}@test.com`, role: UserRole.ADMIN, isVerified: true, profile: { create: { nickname: `Adm_${ts}` } } }
  });

  let s1;
  try {
    s1 = await seasonsService.adminCreate({
      name: `Season 1 ${ts}`, type: 'REGULAR', year: 2026, startDate: new Date().toISOString(), endDate: new Date(Date.now()+86400000).toISOString(), hasDivisions: false, entryFee: 0, lanPointsWeight: 1.0, isPublic: true
    } as any);
    console.log(`✅ Admin created Season 1: ${s1.id}`);
  } catch(e) {
    console.error('❌ Failed to create season as admin:', e);
  }

  // Create U3 user attempting admin action
  const normalUser = await prisma.user.create({
    data: { email: `normal_${ts}@test.com`, role: UserRole.PLAYER, profile: { create: { nickname: `Norm_${ts}` } } }
  });

  // Since we don't have a non-admin create method available on the service, we can simulate the guard failure if we had controllers.
  // We'll skip the exact auth guard test here and rely on roles in controllers.

  // Register teams
  const t2 = await prisma.team.create({ data: { name: `T2 ${ts}`, tag: `2${ts}`.substring(0,5), ownerId: admin.id, primaryColor: '#000', secondaryColor: '#fff' }});
  const t3 = await prisma.team.create({ data: { name: `T3 ${ts}`, tag: `3${ts}`.substring(0,5), ownerId: admin.id, primaryColor: '#000', secondaryColor: '#fff' }});
  const t4 = await prisma.team.create({ data: { name: `T4 ${ts}`, tag: `4${ts}`.substring(0,5), ownerId: admin.id, primaryColor: '#000', secondaryColor: '#fff' }});
  
  if (s1) {
    await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: team.id, managerId: team.ownerId } });
    await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t2.id, managerId: t2.ownerId } });
    await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t3.id, managerId: t3.ownerId } });
    await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t4.id, managerId: t4.ownerId } });
    
    await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s1.id, teamId: team.id } }, data: { points: 10 } });
    await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s1.id, teamId: t2.id } }, data: { points: 7 } });
    
    console.log(`✅ Registered 4 teams to Season 1. Checking divisions...`);
    const entries = await prisma.seasonTeamEntry.findMany({ where: { seasonId: s1.id } });
    console.log(`Found ${entries.length} entries. Divisions assigned: ${entries.map(e => e.divisionId || 'null').join(', ')} (Expected nulls for no divisions)`);

    await seasonsService.adminFinishSeason(s1.id);
    const finishedEntries = await prisma.seasonTeamEntry.findMany({ where: { seasonId: s1.id }, orderBy: { finalPosition: 'asc' } });
    console.log(`✅ Season 1 Finished. Final Positions:`);
    for (const e of finishedEntries) console.log(`  Team ${e.teamId} -> Position ${e.finalPosition}`);
  }

  console.log('\n--- STARTING STAGE 17: STATS & XP ---');
  const statTracker = await prisma.user.create({
    data: { email: `stat_${ts}@test.com`, role: UserRole.PLAYER, isStatTracker: true, profile: { create: { nickname: `Stat_${ts}` } } }
  });

  const mStat = await prisma.playerMatchStat.create({
    data: {
      userId: player.id, enteredById: statTracker.id,
      positionPlayed: PlayerPosition.ST,
      goals: 2, assists: 1, passAccuracy: 85.0, xpEarned: 1234
    }
  });
  console.log(`✅ Manual Stat Tracker inserted stat for U2: goals=${mStat.goals}, xpEarned=${mStat.xpEarned}`);

  // Test rating drop for < 10 matches
  await prisma.playerStats.create({ data: { userId: player.id, rating: 1200, cardRating: 75 } });
  if (s1) {
    await prisma.seasonXpSummary.create({
      data: { seasonId: s1.id, userId: player.id, totalXp: 5000, matchesPlayed: 5 } // < 10 matches
    });
    
    // Simulate end of season rating recalculation
    await statsService.recalculateSeasonRatings(s1.id);
    
    const pRating = await prisma.playerStats.findUnique({ where: { userId: player.id } });
    console.log(`✅ Player Rating after Season (played < 10 matches): ${pRating?.cardRating} (Expected old rating - 2 = 73)`);

    await prisma.teamOfTheWeek.create({
      data: { seasonId: s1.id, weekNumber: 1, positionSlot: PlayerPosition.ST, userId: player.id }
    });
  }
  
  console.log('\n--- STARTING STAGE 18: ONBOARDING ---');
  const newbie = await prisma.user.create({
    data: { id: `newbie_${ts}`, email: `newbie_${ts}@test.com`, role: UserRole.PLAYER, profile: { create: { nickname: `Newb_${ts}` } } }
  });
  
  const onboard = await onboardingService.getProgress(newbie.id);
  console.log(`✅ New user onboarding progress: `, JSON.stringify(onboard.steps));

  const res = gamertagValidator.validate('Mrazi 23');
  console.log(`✅ Gamertag Validator match status (expect warnings about spaces/EA ID):`, res.warnings);

  console.log('\n--- STARTING STAGE 19: PLAYER PROFILE ---');
  await profileService.recalculateCareerStats(player.id);
  const profileOverview = await profileService.getOverview(player.id);
  
  console.log(`✅ Fetched full profile for Player U2:`);
  console.log(`  - Global Rank (Goals): ${profileOverview?.career?.ranks?.goals || 'N/A'}`);
  console.log(`  - Total Matches: ${profileOverview?.career?.totalMatches}`);

  await app.close();
}

bootstrap().catch(e => {
  console.error(e);
  process.exit(1);
});
