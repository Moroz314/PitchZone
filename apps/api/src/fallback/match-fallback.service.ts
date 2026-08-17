import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const MATCH_FALLBACK_QUEUE = 'match-fallback';
export const FALLBACK_CHECK_JOB = 'fallback-check';
export const FALLBACK_CONFIRMATION_JOB = 'fallback-confirmation';

@Injectable()
export class MatchFallbackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchFallbackService.name);
  private connection!: IORedis;
  private queue!: Queue;

  constructor(private readonly config: ConfigService) {}

  get fallbackDelayMinutes(): number {
    return Number(this.config.get('EA_SYNC_FALLBACK_DELAY_MINUTES') ?? 45);
  }

  get confirmationTimeoutMinutes(): number {
    return Number(this.config.get('EA_SYNC_FALLBACK_CONFIRMATION_MINUTES') ?? 15);
  }

  get fallbackDelayMs(): number {
    return this.fallbackDelayMinutes * 60 * 1000;
  }

  get confirmationTimeoutMs(): number {
    return this.confirmationTimeoutMinutes * 60 * 1000;
  }

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(MATCH_FALLBACK_QUEUE, { connection: this.connection });
    this.logger.log('Match fallback queue ready');
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.connection?.quit();
  }

  async scheduleFallbackCheck(matchId: string, scheduledAt: Date) {
    const runAt = new Date(scheduledAt.getTime() + this.fallbackDelayMs);
    const delay = Math.max(0, runAt.getTime() - Date.now());
    const jobId = this.checkJobId(matchId);

    await this.remove(jobId);
    const job = await this.queue.add(
      FALLBACK_CHECK_JOB,
      { matchId },
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: 20,
      },
    );

    this.logger.log(
      `Scheduled fallback check for match ${matchId} at ${runAt.toISOString()} (delay ${delay}ms)`,
    );
    return job;
  }

  async cancelFallbackCheck(matchId: string) {
    return this.remove(this.checkJobId(matchId));
  }

  async scheduleAutoAccept(matchId: string, submittedAt: Date) {
    const runAt = new Date(submittedAt.getTime() + this.confirmationTimeoutMs);
    const delay = Math.max(0, runAt.getTime() - Date.now());
    const jobId = this.confirmationJobId(matchId);

    await this.remove(jobId);
    const job = await this.queue.add(
      FALLBACK_CONFIRMATION_JOB,
      { matchId },
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: 20,
      },
    );

    this.logger.log(
      `Scheduled auto-accept for match ${matchId} at ${runAt.toISOString()} (delay ${delay}ms)`,
    );
    return job;
  }

  async cancelAutoAccept(matchId: string) {
    return this.remove(this.confirmationJobId(matchId));
  }

  private async remove(jobId: string) {
    try {
      const count = await this.queue.remove(jobId);
      return count;
    } catch {
      return 0;
    }
  }

  private checkJobId(matchId: string) {
    return `fallback-check-${matchId}`;
  }

  private confirmationJobId(matchId: string) {
    return `fallback-confirm-${matchId}`;
  }
}
