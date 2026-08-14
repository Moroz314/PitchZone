/**
 * Poll EA after ULTRAS vs Level Pro (Golden G7, 22:15 MSK).
 * Run AFTER the match: npm run seed:last-dance && npm run seed:ld-g7-poll
 */
import { NestFactory } from '@nestjs/core';

import { resetEaMatchForPoll } from '../prisma/seed-ea-demo-roster';
import { LD_G7_MATCH_ID } from '../prisma/seed-ld-g7-rosters';
import { AppModule } from '../src/app.module';
import { EaSyncService } from '../src/ea-sync/ea-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    await resetEaMatchForPoll(prisma, LD_G7_MATCH_ID);

    const eaSync = app.get(EaSyncService);
    console.log('Polling EA for ULTRAS (FC ARTEX 4372453) vs Level Pro (7204)...\n');
    const result = await eaSync.pollAllActiveClubs();
    console.log(JSON.stringify(result, null, 2));

    const match = await prisma.seasonMatch.findUnique({
      where: { id: LD_G7_MATCH_ID },
      select: { status: true, homeScore: true, awayScore: true, eaMatchId: true, playedAt: true },
    });
    console.log('\nMatch state:', match);
    console.log(`\nOpen: /seasons/matches/${LD_G7_MATCH_ID}`);
    console.log('Season: /seasons/demo-last-dance-2026');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
