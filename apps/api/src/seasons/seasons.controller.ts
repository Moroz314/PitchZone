import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SeasonStatus } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterSeasonDto } from './dto/season.dto';
import { SeasonsService } from './seasons.service';

@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Get('calendar')
  getCalendar() {
    return this.seasons.getCalendar();
  }

  @Get('current')
  getCurrent() {
    return this.seasons.getCurrent();
  }

  @Get('lan-path')
  getLanPath(@Query('year') year?: string) {
    return this.seasons.getLanPath(year ? Number(year) : undefined);
  }

  @Get()
  list(@Query('status') status?: SeasonStatus) {
    return this.seasons.listPublic(status);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.seasons.getById(id);
  }

  @Get(':id/standings')
  getStandings(@Param('id') id: string, @Query('divisionId') divisionId?: string) {
    return this.seasons.getStandings(id, divisionId);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  register(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterSeasonDto,
  ) {
    return this.seasons.registerTeam(id, user.id, dto.teamId);
  }
}
