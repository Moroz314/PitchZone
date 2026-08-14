import { Module } from '@nestjs/common';

import { ContractsModule } from '../contracts/contracts.module';
import { StatsModule } from '../stats/stats.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [ContractsModule, StatsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
