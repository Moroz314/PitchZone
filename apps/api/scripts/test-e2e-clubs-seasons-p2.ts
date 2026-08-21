import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SeasonsService } from '../src/seasons/seasons.service';
import { StatsService } from '../src/stats/stats.service';
import { UserRole, PlayerPosition } from '@prisma/client';

async function bootstrap() {
  console.log('Bootstrapping Extended E2E Test Part 2...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const seasonsService = app.get(SeasonsService);
  const statsService = app.get(StatsService);

  const ts = Date.now();
  
  console.log('\n--- SCENARIO 1: TOTW BONUS (RATING < 75) ---');
  // Create user with rating < 75
  const u1 = await prisma.user.create({
    data: { email: `totw_${ts}@test.com`, role: UserRole.PLAYER, isVerified: true, profile: { create: { nickname: `Totw_${ts}` } } }
  });
  // Initial stats: cardRating = 60
  await prisma.playerStats.create({ data: { userId: u1.id, cardRating: 60, totwCount: 0 } });
  
  const sTotw = await seasonsService.adminCreate({
      name: `TOTW Season ${ts}`, type: 'REGULAR', year: 2026, startDate: new Date().toISOString(), endDate: new Date(Date.now()+86400000).toISOString(), hasDivisions: false, entryFee: 0, lanPointsWeight: 1.0, isPublic: true
  } as any);
  
  await statsService.setTotw(sTotw.id, { weekNumber: 1, slots: [{ userId: u1.id, positionSlot: PlayerPosition.ST }] });
  const pRatingAfterTotw = await prisma.playerStats.findUnique({ where: { userId: u1.id } });
  console.log(`✅ Player Rating after TOTW (initial 60): ${pRatingAfterTotw?.cardRating} (Expected: 75)`);
  
  
  console.log('\n--- SCENARIO 2: RATING CAP (MAX ±5) ---');
  const u2 = await prisma.user.create({
    data: { email: `cap_${ts}@test.com`, role: UserRole.PLAYER, isVerified: true, profile: { create: { nickname: `Cap_${ts}` } } }
  });
  // Initial stats: cardRating = 80
  await prisma.playerStats.create({ data: { userId: u2.id, cardRating: 80 } });
  
  const sCap = await seasonsService.adminCreate({
      name: `Cap Season ${ts}`, type: 'REGULAR', year: 2026, startDate: new Date().toISOString(), endDate: new Date(Date.now()+86400000).toISOString(), hasDivisions: false, entryFee: 0, lanPointsWeight: 1.0, isPublic: true
  } as any);
  
  await prisma.seasonXpSummary.create({
      data: { seasonId: sCap.id, userId: u2.id, totalXp: 50000, matchesPlayed: 25 }
  });
  
  await prisma.season.update({ where: { id: sCap.id }, data: { status: 'FINISHED' } });
  
  // Recalculate season ratings
  await statsService.recalculateSeasonRatings(sCap.id);
  const pRatingAfterSeason = await prisma.playerStats.findUnique({ where: { userId: u2.id } });
  console.log(`✅ Player Rating after insane season (initial 80): ${pRatingAfterSeason?.cardRating} (Expected max jump to 85)`);


  console.log('\n--- SCENARIO 3: SEASON 2 DIVISION DISTRIBUTION ---');
  const admin = await prisma.user.create({
    data: { email: `adm2_${ts}@test.com`, role: UserRole.ADMIN, isVerified: true, profile: { create: { nickname: `Adm2_${ts}` } } }
  });
  
  const t1 = await prisma.team.create({ data: { name: `T1 ${ts}`, tag: `1${ts.toString().slice(-4)}`, ownerId: admin.id }});
  const t2 = await prisma.team.create({ data: { name: `T2 ${ts}`, tag: `2${ts.toString().slice(-4)}`, ownerId: admin.id }});
  const t3 = await prisma.team.create({ data: { name: `T3 ${ts}`, tag: `3${ts.toString().slice(-4)}`, ownerId: admin.id }});
  const t4 = await prisma.team.create({ data: { name: `T4 ${ts}`, tag: `4${ts.toString().slice(-4)}`, ownerId: admin.id }});
  
  const s1 = await seasonsService.adminCreate({
      name: `Season 1 (No Divs) ${ts}`, type: 'REGULAR', year: 2026, startDate: new Date(Date.now() - 86400000 * 2).toISOString(), endDate: new Date(Date.now() - 86400000).toISOString(), hasDivisions: false, entryFee: 0, lanPointsWeight: 1.0, isPublic: true
  } as any);
  await prisma.season.update({ where: { id: s1.id }, data: { status: 'REGISTRATION' } });
  
  await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t1.id, managerId: admin.id } });
  await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t2.id, managerId: admin.id } });
  await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t3.id, managerId: admin.id } });
  await prisma.seasonTeamEntry.create({ data: { seasonId: s1.id, teamId: t4.id, managerId: admin.id } });
  
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s1.id, teamId: t1.id } }, data: { points: 15 } });
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s1.id, teamId: t2.id } }, data: { points: 10 } });
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s1.id, teamId: t3.id } }, data: { points: 5 } });
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s1.id, teamId: t4.id } }, data: { points: 0 } });
  
  await seasonsService.adminFinishSeason(s1.id);
  
  const s2 = await seasonsService.adminCreate({
      name: `Season 2 (Divs) ${ts}`, type: 'REGULAR', year: 2026, startDate: new Date().toISOString(), endDate: new Date(Date.now()+86400000).toISOString(), hasDivisions: true, entryFee: 0, lanPointsWeight: 1.0, isPublic: true
  } as any);
  await prisma.season.update({ where: { id: s2.id }, data: { status: 'REGISTRATION' } });
  
  await seasonsService.registerTeam(s2.id, admin.id, t1.id).catch(() => {});
  await seasonsService.registerTeam(s2.id, admin.id, t2.id).catch(() => {});
  await seasonsService.registerTeam(s2.id, admin.id, t3.id).catch(() => {});
  await seasonsService.registerTeam(s2.id, admin.id, t4.id).catch(() => {});
  
  // Since we don't have members, registerTeam throws Forbidden. So let's insert directly for s2 as well, using seasonsService for the divisions assignment part, or just fixing members.
  // Actually, wait, `registerTeam` calls `resolveDivisionForTeam`. So we MUST call `registerTeam` to test the logic! 
  // Let's add the admin as a member to the teams so `registerTeam` passes.
  await prisma.teamMember.create({ data: { teamId: t1.id, userId: admin.id, role: 'OWNER' }});
  await prisma.teamMember.create({ data: { teamId: t2.id, userId: admin.id, role: 'OWNER' }});
  await prisma.teamMember.create({ data: { teamId: t3.id, userId: admin.id, role: 'OWNER' }});
  await prisma.teamMember.create({ data: { teamId: t4.id, userId: admin.id, role: 'OWNER' }});
  
  // Re-run registration for S2 properly now that auth is fixed:
  await seasonsService.registerTeam(s2.id, admin.id, t1.id);
  await seasonsService.registerTeam(s2.id, admin.id, t2.id);
  await seasonsService.registerTeam(s2.id, admin.id, t3.id);
  await seasonsService.registerTeam(s2.id, admin.id, t4.id);
  
  const s2Entries = await prisma.seasonTeamEntry.findMany({ 
    where: { seasonId: s2.id },
    include: { division: true },
    orderBy: { teamId: 'asc' }
  });
  
  console.log(`✅ Season 2 Divisions for teams (where previous season had NO divisions):`);
  for (const e of s2Entries) {
    console.log(`  Team ${e.teamId} -> Division: ${e.division?.name || 'null'}`);
  }

  await seasonsService.adminFinishSeason(s2.id);
  
  // Create Season 3 to test regular promotion/relegation
  const s3 = await seasonsService.adminCreate({
      name: `Season 3 (Divs) ${ts}`, type: 'REGULAR', year: 2026, startDate: new Date(Date.now()+86400000*2).toISOString(), endDate: new Date(Date.now()+86400000*3).toISOString(), hasDivisions: true, entryFee: 0, lanPointsWeight: 1.0, isPublic: true
  } as any);
  await prisma.season.update({ where: { id: s3.id }, data: { status: 'REGISTRATION' } });
  
  const s3Full = await seasonsService.getById(s3.id);
  const s3Gold = s3Full.divisions.find((d: any) => d.name === 'GOLD');
  const s3Silver = s3Full.divisions.find((d: any) => d.name === 'SILVER');
  const s3Bronze = s3Full.divisions.find((d: any) => d.name === 'BRONZE');
  
  await seasonsService.adminSetPromotionRules(s3.id, {
    rules: [
      { divisionId: s3Gold!.id, promoteTopN: 0, relegateBottomN: 1 }, // Relegate bottom 1 from Gold
      { divisionId: s3Silver!.id, promoteTopN: 1, relegateBottomN: 1 }, // Promote top 1 from Silver, relegate bottom 1
      { divisionId: s3Bronze!.id, promoteTopN: 1, relegateBottomN: 0 } // Promote top 1 from Bronze
    ]
  });
  
  // For S2, positions:
  // t1 was GOLD (only 1 team, so position 1)
  // t2 was SILVER (only 1 team, so position 1)
  // t3 was BRONZE (points: 5) -> pos 1
  // t4 was BRONZE (points: 0) -> pos 2
  // Let's verify by registering them for S3
  const t1s3 = await seasonsService.registerTeam(s3.id, admin.id, t1.id);
  const t2s3 = await seasonsService.registerTeam(s3.id, admin.id, t2.id);
  const t3s3 = await seasonsService.registerTeam(s3.id, admin.id, t3.id);
  const t4s3 = await seasonsService.registerTeam(s3.id, admin.id, t4.id);
  
  console.log('\n--- SCENARIO 4: NORMAL PROMOTION/RELEGATION ---');
  console.log(`Team 1 (was Gold #1) -> S3 Division: ${t1s3.division?.name} (Expected: GOLD or SILVER if relegated)`); // 1 team in Gold, pos 1. 1 - 1 = 0. Pos 1 > 0 -> Relegated to SILVER!
  console.log(`Team 2 (was Silver #1) -> S3 Division: ${t2s3.division?.name} (Expected: GOLD)`); // 1 team in Silver, pos 1 <= 1 -> Promoted to GOLD!
  console.log(`Team 3 (was Bronze #1) -> S3 Division: ${t3s3.division?.name} (Expected: SILVER)`); // pos 1 <= 1 -> Promoted to SILVER!
  console.log(`Team 4 (was Bronze #2) -> S3 Division: ${t4s3.division?.name} (Expected: BRONZE)`); // pos 2 -> BRONZE
  
  // Finish S3 so we have 3 seasons of data
  // T3: 5 pts (S1) + 15 pts (S3) = 20. GD: 0 + 5 = 5.
  // T4: 0 pts (S1) + 20 pts (S3) = 20. GD: 0 + 10 = 10.
  // T4 should rank higher than T3!
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s3.id, teamId: t1.id } }, data: { points: 10 } });
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s3.id, teamId: t2.id } }, data: { points: 20 } });
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s3.id, teamId: t3.id } }, data: { points: 15, goalsFor: 10, goalsAgainst: 5 } });
  await prisma.seasonTeamEntry.update({ where: { seasonId_teamId: { seasonId: s3.id, teamId: t4.id } }, data: { points: 20, goalsFor: 15, goalsAgainst: 5 } });
  await seasonsService.adminFinishSeason(s3.id);
  
  // Run Annual Standing calculation
  await seasonsService.adminCalculateAnnual({ year: 2026 });
  const lanResult = await seasonsService.getLanPath(2026);
  
  console.log('\n--- SCENARIO 5: ANNUAL STANDINGS ---');
  console.log(`LAN Settings: qualifyTopN=${lanResult.qualifyTopN}, calculated=${lanResult.calculated}`);
  for (const s of lanResult.standings) {
    console.log(`Rank ${s.rank}: ${s.team.name} - ${s.totalPoints} pts, LAN: ${s.qualifiedForLan}`);
  }
}

bootstrap().then(() => {
  console.log('\nDone.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
