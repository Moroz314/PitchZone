import { Module } from '@nestjs/common';

import { PlayerProfileController } from './player-profile.controller';
import { PlayerProfileAggregationService } from './player-profile.service';

@Module({
  controllers: [PlayerProfileController],
  providers: [PlayerProfileAggregationService],
  exports: [PlayerProfileAggregationService],
})
export class PlayerProfileModule {}
