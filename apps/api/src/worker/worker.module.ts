import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EaSyncModule } from '../ea-sync/ea-sync.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EaSyncWorkerService } from './ea-sync-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    PrismaModule,
    EaSyncModule,
  ],
  providers: [EaSyncWorkerService],
})
export class WorkerModule {}
