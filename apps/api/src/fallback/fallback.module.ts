import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MatchFallbackService } from './match-fallback.service';

@Module({
  imports: [ConfigModule],
  providers: [MatchFallbackService],
  exports: [MatchFallbackService],
})
export class FallbackModule {}
