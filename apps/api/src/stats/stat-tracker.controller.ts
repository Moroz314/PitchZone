import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CompleteSeasonMatchDto,
  CreateSeasonMatchDto,
  RecalculateRatingsDto,
  SubmitMatchStatsDto,
  TotsSelectionDto,
  TotwSelectionDto,
} from './dto/stats.dto';
import { StatTrackerGuard } from './stat-tracker.guard';
import { StatsService } from './stats.service';

@Controller('stat-tracker')
@UseGuards(JwtAuthGuard, StatTrackerGuard)
export class StatTrackerController {
  constructor(private readonly stats: StatsService) {}

  @Get('season-matches')
  listSeasonMatches(@Query('seasonId') seasonId?: string) {
    return this.stats.listSeasonMatches(seasonId);
  }

  @Post('season-matches')
  createSeasonMatch(@Body() dto: CreateSeasonMatchDto) {
    return this.stats.createSeasonMatch(dto);
  }

  @Patch('season-matches/:id/complete')
  completeSeasonMatch(@Param('id') id: string, @Body() dto: CompleteSeasonMatchDto) {
    return this.stats.completeSeasonMatch(id, dto);
  }

  @Post('season-matches/:id/stats')
  submitMatchStats(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitMatchStatsDto,
  ) {
    return this.stats.submitMatchStats(id, user.id, dto.players);
  }

  @Post('seasons/:seasonId/totw')
  setTotwForSeason(@Param('seasonId') seasonId: string, @Body() dto: TotwSelectionDto) {
    return this.stats.setTotw(seasonId, dto);
  }

  @Post('seasons/:seasonId/tots')
  setTots(@Param('seasonId') seasonId: string, @Body() dto: TotsSelectionDto) {
    return this.stats.setTots(seasonId, dto);
  }

  @Post('seasons/recalculate-ratings')
  recalculateRatings(@Body() dto: RecalculateRatingsDto) {
    return this.stats.recalculateSeasonRatings(dto.seasonId);
  }
}
