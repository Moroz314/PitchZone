import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TournamentsService } from '../src/tournaments/tournaments.service';
import { BracketService } from '../src/tournaments/bracket.service';
import { PaymentsService } from '../src/payments/payments.service';
import { MatchFallbackService } from '../src/fallback/match-fallback.service';
import { EaSyncService } from '../src/ea-sync/ea-sync.service';
import { TournamentFormat, MatchStatus, TournamentStatus, PrizePoolType, EaClubPlatform } from '@prisma/client';

async function bootstrap() {
  console.log('Bootstrapping E2E Test...');
  let app;
  try {
    const timestamp = Date.now();
    app = await NestFactory.createApplicationContext(AppModule);
    const prisma = app.get(PrismaService);
    const tournamentsService = app.get(TournamentsService);
    const bracketService = app.get(BracketService);
    const fallbackService = app.get(MatchFallbackService);
    const eaSyncService = app.get(EaSyncService);
    const paymentsService = app.get(PaymentsService);

    // 1. Create Organizer
    const organizer = await prisma.user.create({
      data: {
        id: `org_${timestamp}`,
        email: `org_${timestamp}@test.com`,
        passwordHash: 'hash',
        role: 'ADMIN',
        profile: {
          create: { nickname: `org_${timestamp}` }
        }
      }
    });

    // 2. Create 4 users and 4 teams
    const teams: any[] = [];
    for (let i = 1; i <= 4; i++) {
      const p1 = await prisma.user.create({
        data: {
          id: `p1_t${i}_${timestamp}`,
          email: `p1_t${i}_${timestamp}@test.com`,
          passwordHash: 'hash',
          profile: { create: { nickname: `p1_t${i}_${timestamp}` } },
          wallet: { create: { balance: 1000 } }
        }
      });
      const p2 = await prisma.user.create({
        data: {
          id: `p2_t${i}_${timestamp}`,
          email: `p2_t${i}_${timestamp}@test.com`,
          passwordHash: 'hash',
          profile: { create: { nickname: `p2_t${i}_${timestamp}` } },
          wallet: { create: { balance: 1000 } }
        }
      });
      const team = await prisma.team.create({
        data: {
          name: `Team ${i} ${timestamp}`,
          tag: `T${i}${timestamp.toString().slice(-3)}`.substring(0, 5),
          ownerId: p1.id,
          members: {
            create: [
              { userId: p1.id, role: 'OWNER' },
              { userId: p2.id, role: 'MEMBER' }
            ]
          }
        },
        include: { members: true }
      });
      teams.push(team);
    }

    console.log('Users and Teams created.');

    // 3. Create Tournament
    const tournament = await prisma.tournament.create({
      data: {
        title: `E2E Test Tournament ${timestamp}`,
        slug: `e2e-test-${timestamp}`,
        organizerId: organizer.id,
        format: TournamentFormat.ROUND_ROBIN,
        teamSize: 2,
        maxParticipants: 4,
        minParticipants: 4,
        entryFee: 0,
        prizePoolType: PrizePoolType.FIXED_SPONSORED,
        fixedPrizePool: 14814,
        prizeDistribution: [{ place: 1, percent: 33 }, { place: 2, percent: 67 }],
        startsAt: new Date(),
        status: TournamentStatus.REGISTRATION_OPEN,
        platformCommissionPercent: 10,
      }
    });

    console.log('Tournament created.');

    // 4. Test EA Validation and Register
    for (const team of teams) {
      // Should fail registration without EA club
      let failed = false;
      try {
        await tournamentsService.register(tournament.id, team.ownerId, { teamId: team.id });
      } catch (e: any) {
        failed = true;
      }
      if (!failed) {
        console.error(`Team ${team.id} registered without EA Club Link!`);
      }

      // Add EA Club Link
      await prisma.eaClubLink.create({
        data: {
          teamId: team.id,
          platform: EaClubPlatform.PC,
          eaClubId: `ea_${team.id}`,
          gameVersion: 'FC25'
        }
      });

      // Now register successfully
      await tournamentsService.register(tournament.id, team.ownerId, { teamId: team.id });
    }
    console.log('Teams registered with EA Clubs.');

    // Process mock payments properly
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id }
    });
    for (const p of participants) {
      await paymentsService.completeEntryPayment({
        participantId: p.id,
        userId: teams.find(t => t.id === p.teamId)!.ownerId,
        mock: true
      });
    }

    // 5. Generate Bracket
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.LIVE }
    });
    await bracketService.generateBracket(tournament.id, tournament.format);
    console.log('Bracket generated.');

    // 6. Play Group Matches
    let matches = await prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { round: 'asc' }
    });

    console.log(`Total matches generated: ${matches.length}`);

    // We will simulate EA Sync for all matches except one
    const groupMatches = matches.filter(m => m.participant1Id && m.participant2Id);
    
    // Simulate EA sync for the first group match
    await bracketService.finalizeMatchFromEa(groupMatches[0].id, 3, 1);
    
    // Simulate Fallback for the second group match (no EA data)
    const m2 = groupMatches[1];
    const p1 = await prisma.tournamentParticipant.findUnique({ where: { id: m2.participant1Id! }});
    await prisma.matchSubmission.create({
      data: {
        matchId: m2.id,
        participantId: m2.participant1Id!,
        userId: teams.find(t => t.id === p1!.teamId)!.ownerId,
        score1: 2,
        score2: 0,
        proofUrl: 'http://test.com/proof.jpg'
      }
    });
    // Fallback flow ultimately finalizes match:
    await bracketService.finalizeMatch(m2.id, 2, 0);

    // Simulate EA sync for the rest
    for (let i = 2; i < groupMatches.length; i++) {
      const m = groupMatches[i];
      if (m.status !== MatchStatus.COMPLETED) {
        await bracketService.finalizeMatchFromEa(m.id, 1, 0); // participant 1 always wins 1-0
      }
    }

    console.log('Group matches completed.');
    
    // Wait for the single transaction and bracket generation to settle.
    const finalMatches = await prisma.match.findMany({
      where: { tournamentId: tournament.id, status: MatchStatus.PENDING }
    });
    
    console.log(`Pending playoff matches: ${finalMatches.length}`);
    
    if (finalMatches.length > 0) {
       for (const m of finalMatches) {
          if (m.participant1Id && m.participant2Id) {
             await bracketService.finalizeMatchFromEa(m.id, 2, 1);
          }
       }
    }

    // Refresh tournament
    const tFinal = await prisma.tournament.findUnique({
      where: { id: tournament.id },
      include: {
        escrow: true,
        participants: true,
      }
    });
    
    console.log(`\n--- REAL DB RESULTS ---`);
    console.log(`Tournament Status: ${tFinal?.status}`);
    console.log(`Escrow Status: ${tFinal?.escrow?.status}`);
    
    // Check Team Awards
    const teamAwards = await prisma.teamAward.findMany({
      where: { teamId: { in: teams.map(t => t.id) } },
      include: { award: true }
    });
    console.log(`Team Awards created: ${teamAwards.length}`);
    for (const ta of teamAwards) {
      console.log(`  - Team ${ta.teamId} received Award '${ta.award.name}' with text: '${ta.awardedForText}'`);
    }

    // Check User Awards
    const userAwards = await prisma.userAward.findMany({
      where: { userId: { in: teams.flatMap(t => [t.ownerId, ...t.members.map(m => m.userId)]) } },
      include: { award: true }
    });
    console.log(`User Awards created: ${userAwards.length}`);
    for (const ua of userAwards) {
      console.log(`  - User ${ua.userId} received Award '${ua.award.name}'`);
    }
    
    // Check Wallets
    const wallets = await prisma.wallet.findMany({
      where: { userId: { in: teams.map(t => t.ownerId) } }
    });
    console.log(`Wallet balances:`);
    for (const w of wallets) {
       console.log(`  - Wallet ${w.userId}: balance ${w.balance}`);
    }

    // Check Transactions
    const txs = await prisma.transaction.findMany({
      where: { relatedTournamentId: tournament.id }
    });
    console.log(`Transactions recorded: ${txs.length}`);
    for (const t of txs) {
       console.log(`  - ${t.type} | Amount: ${t.amount} | Status: ${t.status} | User: ${t.userId}`);
    }

    console.log('\nE2E Test Finished Successfully.');
  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    if (app) await app.close();
  }
}

bootstrap().catch(err => {
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
