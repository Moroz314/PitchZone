import { Controller, Get, Param, Query } from '@nestjs/common';

import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('seasons/:seasonId/matches')
  getSeasonMatches(@Param('seasonId') seasonId: string) {
    return this.stats.getPublicSeasonMatches(seasonId);
  }

  @Get('matches/:matchId')
  getSeasonMatchDetail(@Param('matchId') matchId: string) {
    return this.stats.getSeasonMatchDetail(matchId);
  }

  @Get('players/:userId/matches')
  getPlayerMatchStats(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.stats.getPlayerMatchStats(userId, limit ? Number(limit) : 50);
  }

  @Get('players/:userId/card')
  getPlayerCard(@Param('userId') userId: string) {
    return this.stats.getPlayerCardProfile(userId);
  }

  @Get('seasons/:seasonId/xp-leaderboard')
  getXpLeaderboard(@Param('seasonId') seasonId: string, @Query('limit') limit?: string) {
    return this.stats.getSeasonXpLeaderboard(seasonId, limit ? Number(limit) : 50);
  }

  @Get('seasons/:seasonId/totw/:weekNumber')
  getTotw(@Param('seasonId') seasonId: string, @Param('weekNumber') weekNumber: string) {
    return this.stats.getTotw(seasonId, Number(weekNumber));
  }

  @Get('seasons/:seasonId/tots')
  getTots(@Param('seasonId') seasonId: string) {
    return this.stats.getTots(seasonId);
  }
}
