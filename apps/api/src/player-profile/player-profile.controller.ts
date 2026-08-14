import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AwardCategory, PlayerPosition } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { STAT_CATEGORIES, type StatCategoryId } from './constants/profile-stats.constants';
import { PlayerProfileAggregationService } from './player-profile.service';

@Controller('player-profile')
export class PlayerProfileController {
  constructor(private readonly profile: PlayerProfileAggregationService) {}

  @Get('meta/stat-categories')
  getStatCategories() {
    return STAT_CATEGORIES;
  }

  @Get(':userId/overview')
  getOverview(@Param('userId') userId: string) {
    return this.profile.getOverview(userId);
  }

  @Get(':userId/statistics')
  getStatistics(
    @Param('userId') userId: string,
    @Query('tab') tab?: 'season' | 'tournament' | 'club' | 'match',
    @Query('position') position?: PlayerPosition,
    @Query('category') category?: StatCategoryId,
  ) {
    return this.profile.getStatistics(userId, tab ?? 'season', position, category ?? 'summary');
  }

  @Get(':userId/transfers')
  getTransfers(@Param('userId') userId: string) {
    return this.profile.getTransfers(userId);
  }

  @Get(':userId/awards')
  getAwards(@Param('userId') userId: string, @Query('category') category?: AwardCategory) {
    return this.profile.getAwards(userId, category);
  }

  @Patch('me/awards/:userAwardId/pin')
  @UseGuards(JwtAuthGuard)
  pinAward(
    @CurrentUser() user: { id: string },
    @Param('userAwardId') userAwardId: string,
    @Body() body: { pinned: boolean },
  ) {
    return this.profile.pinAward(user.id, userAwardId, body.pinned);
  }
}
