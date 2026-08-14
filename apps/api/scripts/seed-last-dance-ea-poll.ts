/**
 * Poll EA API and import into Last Dance 2026 fixture NHOP vs Amity.
 * Run: npm run seed:last-dance && npm run seed:last-dance-ea-poll
 */
import { NestFactory } from '@nestjs/core';

import { EA_LAST_DANCE_MATCH_ID, resetEaMatchForPoll } from '../prisma/seed-ea-demo-roster';
import { AppModule } from '../src/app.module';
import { EaSyncService } from '../src/ea-sync/ea-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    await resetEaMatchForPoll(prisma, EA_LAST_DANCE_MATCH_ID);

    const eaSync = app.get(EaSyncService);
    console.log('Polling EA Pro Clubs for Last Dance NHOP vs Amity...\n');
    const result = await eaSync.pollAllActiveClubs();
    console.log(JSON.stringify(result, null, 2));

    const match = await prisma.seasonMatch.findUnique({
      where: { id: EA_LAST_DANCE_MATCH_ID },
      select: { status: true, homeScore: true, awayScore: true, eaMatchId: true },
    });
    console.log('\nLast Dance match:', match);
    console.log(`\nOpen: /seasons/matches/${EA_LAST_DANCE_MATCH_ID}`);
    console.log(`Season: /seasons/demo-last-dance-2026`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
