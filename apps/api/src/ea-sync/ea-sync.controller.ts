import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EaClubLinkService } from './ea-club-link.service';
import { EaSyncService } from './ea-sync.service';
import { UpdateEaClubLinkDto } from './dto/ea-sync.dto';
import { StatTrackerGuard } from '../stats/stat-tracker.guard';

@Controller('ea-sync')
export class EaSyncController {
  constructor(
    private readonly eaSync: EaSyncService,
    private readonly clubLinks: EaClubLinkService,
  ) {}

  @Get('clubs/:teamId/link')
  getClubLink(@Param('teamId') teamId: string) {
    return this.clubLinks.getByTeamId(teamId);
  }

  @Put('clubs/:teamId/link')
  @UseGuards(JwtAuthGuard)
  upsertClubLink(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateEaClubLinkDto,
  ) {
    return this.clubLinks.upsert(teamId, user.id, dto);
  }

  @Post('poll')
  @UseGuards(JwtAuthGuard, StatTrackerGuard)
  triggerPoll() {
    return this.eaSync.pollAllActiveClubs();
  }

  @Post('poll/:teamId')
  @UseGuards(JwtAuthGuard, StatTrackerGuard)
  triggerPollTeam(@Param('teamId') teamId: string) {
    return this.eaSync.pollSingleClub(teamId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, StatTrackerGuard)
  getStatus() {
    return this.eaSync.getDashboardStatus();
  }

  @Get('imports')
  @UseGuards(JwtAuthGuard, StatTrackerGuard)
  listImports() {
    return this.eaSync.listImports();
  }
}
