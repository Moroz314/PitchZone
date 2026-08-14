/**
 * Creates a 4-team round robin tournament and tests EA sync for tournament matches.
 * Prerequisites: npm run seed && npm run seed:last-dance (for ULTR/LVPR EA links)
 *
 * Run: npm run seed:tournament-ea-test
 */
import {
  GameTitle,
  MatchFormat,
  MatchStatus,
  ParticipantType,
  PaymentStatus,
  TournamentFormat,
  TournamentStatus,
  TournamentVisibility,
} from '@prisma/client';
import { NestFactory } from '@nestjs/core';

import { ensureEaDemoRoster } from '../prisma/seed-ea-demo-roster';
import { ensureLdG7Rosters, LD_G7_PLAYED_AT } from '../prisma/seed-ld-g7-rosters';
import { AppModule } from '../src/app.module';
import { EaSyncService } from '../src/ea-sync/ea-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BracketService } from '../src/tournaments/bracket.service';

const TOURNAMENT_SLUG = 'ea-sync-rr-test';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const bracketService = app.get(BracketService);
    const eaSync = app.get(EaSyncService);

    await ensureEaDemoRoster(prisma);
    await ensureLdG7Rosters(prisma);

    const admin = await prisma.user.findUnique({ where: { email: 'admin@pitchzone.gg' } });
    if (!admin) throw new Error('admin@pitchzone.gg not found — run db:seed first');

    const teams = await prisma.team.findMany({
      where: { tag: { in: ['ULTR', 'LVPR', 'NHOP', 'AMTY'] } },
    });
    if (teams.length < 4) {
      throw new Error('Need ULTR, LVPR, NHOP, AMTY teams — run seed:last-dance + db:seed');
    }

    let tournament = await prisma.tournament.findUnique({ where: { slug: TOURNAMENT_SLUG } });
    if (tournament) {
      await prisma.playerMatchStat.deleteMany({
        where: { tournamentMatch: { tournamentId: tournament.id } },
      });
      await prisma.eaApiMatchImport.deleteMany({
        where: { matchedTournamentMatch: { tournamentId: tournament.id } },
      });
      await prisma.match.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.tournament.delete({ where: { id: tournament.id } });
    }

    tournament = await prisma.tournament.create({
      data: {
        slug: TOURNAMENT_SLUG,
        title: 'EA Sync RR Test (4×2)',
        description: 'Автотест round robin + EA импорт',
        game: GameTitle.EA_FC,
        format: TournamentFormat.ROUND_ROBIN,
        matchFormat: MatchFormat.BO1,
        teamSize: 2,
        status: TournamentStatus.REGISTRATION_CLOSED,
        entryFee: 0,
        maxParticipants: 4,
        minParticipants: 4,
        visibility: TournamentVisibility.PUBLIC,
        startsAt: new Date(LD_G7_PLAYED_AT),
        bannerGradient: 'from-accent/20 via-accent-cyan/10 to-transparent',
        organizerId: admin.id,
      },
    });

    for (const [i, team] of teams.entries()) {
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          teamId: team.id,
          type: ParticipantType.TEAM,
          seed: i + 1,
          paymentStatus: PaymentStatus.PAID,
        },
      });
    }

    await bracketService.generateBracket(
      tournament.id,
      TournamentFormat.ROUND_ROBIN,
    );

    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.BRACKET_GENERATED },
    });

    await bracketService.scheduleFirstRound(tournament.id);
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.LIVE },
    });

    const ultr = teams.find((t) => t.tag === 'ULTR')!;
    const lvpr = teams.find((t) => t.tag === 'LVPR')!;
    const ultrPart = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: ultr.id } },
    });
    const lvprPart = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: lvpr.id } },
    });

    const testMatch = await prisma.match.findFirst({
      where: {
        tournamentId: tournament.id,
        OR: [
          { participant1Id: ultrPart!.id, participant2Id: lvprPart!.id },
          { participant1Id: lvprPart!.id, participant2Id: ultrPart!.id },
        ],
      },
    });

    if (!testMatch) throw new Error('ULTR vs LVPR match not found in bracket');

    await prisma.match.update({
      where: { id: testMatch.id },
      data: {
        scheduledAt: new Date(LD_G7_PLAYED_AT),
        status: MatchStatus.SCHEDULED,
        eaMatchId: null,
        eaSyncStatus: 'AWAITING_EA',
        score1: null,
        score2: null,
        winnerId: null,
      },
    });

    await prisma.playerMatchStat.deleteMany({ where: { tournamentMatchId: testMatch.id } });
    await prisma.eaApiMatchImport.deleteMany({
      where: {
        OR: [
          { eaClubLink: { team: { tag: 'ULTR' } } },
          { eaClubLink: { team: { tag: 'LVPR' } } },
        ],
      },
    });

    console.log(`Tournament: /tournaments/${TOURNAMENT_SLUG}`);
    console.log(`Test match: ${testMatch.id} (ULTR vs LVPR)`);
    console.log(`Scheduled at: ${LD_G7_PLAYED_AT}\n`);
    console.log('Polling EA API...\n');

    const result = await eaSync.pollAllActiveClubs();
    console.log(JSON.stringify(result, null, 2));

    const updated = await prisma.match.findUnique({
      where: { id: testMatch.id },
      include: {
        playerStats: { include: { player: { include: { profile: true } } } },
      },
    });

    console.log('\n--- Match after sync ---');
    console.log({
      status: updated?.status,
      score1: updated?.score1,
      score2: updated?.score2,
      eaSyncStatus: updated?.eaSyncStatus,
      eaMatchId: updated?.eaMatchId,
      playerStatsCount: updated?.playerStats.length,
    });

    if (updated?.playerStats.length) {
      console.log('\nPlayer stats sample:');
      for (const s of updated.playerStats.slice(0, 4)) {
        console.log(
          `  ${s.player.profile?.nickname}: ${s.goals}G ${s.assists}A (XP ${s.xpEarned})`,
        );
      }
    }

    const teamStat = await prisma.teamTournamentStat.findFirst({
      where: { tournamentId: tournament.id, teamId: ultr.id },
    });
    console.log('\nULTR team tournament stat:', teamStat);

    const playerStat = await prisma.playerTournamentStat.findFirst({
      where: { tournamentId: tournament.id },
    });
    console.log('Sample player tournament stat:', playerStat);

    const success =
      updated?.status === 'COMPLETED' &&
      updated.score1 != null &&
      updated.eaSyncStatus === 'SYNCED' &&
      (updated.playerStats.length ?? 0) > 0;

    console.log(success ? '\n✅ EA tournament sync test PASSED' : '\n❌ EA tournament sync test FAILED');
    process.exit(success ? 0 : 1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
