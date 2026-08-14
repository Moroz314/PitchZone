import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { EaSyncService } from '../ea-sync/ea-sync.service';

export const EA_SYNC_QUEUE = 'ea-stats-sync';
export const EA_SYNC_JOB = 'poll-active-clubs';

@Injectable()
export class EaSyncWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EaSyncWorkerService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly eaSync: EaSyncService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue(EA_SYNC_QUEUE, { connection: this.connection });

    const intervalMs = Number(this.config.get('EA_SYNC_INTERVAL_MS') ?? 20 * 60 * 1000);

    await this.queue.add(
      EA_SYNC_JOB,
      {},
      {
        repeat: { every: intervalMs },
        jobId: 'ea-sync-repeat',
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    this.worker = new Worker(
      EA_SYNC_QUEUE,
      async (_job: Job) => {
        this.logger.log('Starting EA clubs poll...');
        const result = await this.eaSync.pollAllActiveClubs();
        this.logger.log(
          `EA poll done: ${result.imported} imported, ${result.needsReview} review, ${result.skipped} skipped`,
        );
        const stale = await this.eaSync.markStaleAwaitingEaMatches();
        if (stale > 0) {
          this.logger.warn(`Marked ${stale} tournament matches as NEEDS_REVIEW (EA timeout)`);
        }
        return result;
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`EA sync job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log(`EA sync worker started (interval ${intervalMs / 60000} min)`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
