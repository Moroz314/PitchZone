import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('EaSyncWorker');
  await NestFactory.createApplicationContext(WorkerModule);
  logger.log('PitchZone EA sync worker is running');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
