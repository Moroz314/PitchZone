import { Module } from '@nestjs/common';

import { SeasonsModule } from '../seasons/seasons.module';
import { StatTrackerController } from './stat-tracker.controller';
import { StatTrackerGuard } from './stat-tracker.guard';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { TournamentStatsService } from './tournament-stats.service';
import { XpCalculatorService } from './xp-calculator.service';

@Module({
  imports: [SeasonsModule],
  controllers: [StatsController, StatTrackerController],
  providers: [StatsService, TournamentStatsService, XpCalculatorService, StatTrackerGuard],
  exports: [StatsService, TournamentStatsService, XpCalculatorService, StatTrackerGuard],
})
export class StatsModule {}
