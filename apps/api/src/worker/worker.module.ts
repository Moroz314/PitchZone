import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EaSyncModule } from '../ea-sync/ea-sync.module';
import { FallbackModule } from '../fallback/fallback.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { EaSyncWorkerService } from './ea-sync-worker.service';
import { MatchFallbackProcessor } from './match-fallback-processor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    PrismaModule,
    EaSyncModule,
    TournamentsModule,
    FallbackModule,
    NotificationsModule,
  ],
  providers: [EaSyncWorkerService, MatchFallbackProcessor],
})
export class WorkerModule {}
