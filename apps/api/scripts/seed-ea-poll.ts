/**
 * Poll EA API for all linked clubs and import matched season matches.
 * Run after db:seed: npm run seed:ea-poll
 */
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { EaSyncService } from '../src/ea-sync/ea-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);

    // Reset demo EA match so poll can import again
    await prisma.playerMatchStat.deleteMany({
      where: { seasonMatchId: 'demo-ea-match-nhope-amity' },
    });
    await prisma.seasonMatch.updateMany({
      where: { id: 'demo-ea-match-nhope-amity' },
      data: {
        eaMatchId: null,
        homeScore: null,
        awayScore: null,
        status: 'SCHEDULED',
      },
    });
    await prisma.eaApiMatchImport.deleteMany({
      where: {
        eaClubLink: { team: { tag: { in: ['NHOP', 'AMTY'] } } },
      },
    });

    const eaSync = app.get(EaSyncService);
    console.log('Polling EA Pro Clubs for all linked teams...\n');
    const result = await eaSync.pollAllActiveClubs();
    console.log(JSON.stringify(result, null, 2));
    console.log('\nOpen match preview: /seasons/matches/demo-ea-match-nhope-amity');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
