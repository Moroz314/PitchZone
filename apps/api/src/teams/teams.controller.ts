import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { AcceptInviteDto, InviteTeamDto } from './dto/invite-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(user.id, dto);
  }

  @Get()
  search(
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.teamsService.search(q, skip ? Number(skip) : 0, take ? Number(take) : 50);
  }

  @Get('invites/me')
  @UseGuards(JwtAuthGuard)
  listMyInvites(@CurrentUser() user: { id: string }) {
    return this.teamsService.listMyInvites(user.id);
  }

  @Get('tag/:tag')
  findByTag(@Param('tag') tag: string) {
    return this.teamsService.findByTag(tag);
  }

  @Get(':id/pending-invites')
  @UseGuards(JwtAuthGuard)
  listPendingInvites(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.teamsService.listPendingInvites(id, user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.teamsService.findById(id);
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  invite(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: InviteTeamDto,
  ) {
    return this.teamsService.invite(id, user.id, dto);
  }

  @Post(':id/accept-invite')
  @UseGuards(JwtAuthGuard)
  acceptInvite(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AcceptInviteDto,
  ) {
    return this.teamsService.acceptInvite(id, user.id, dto);
  }

  @Post('invites/:inviteId/decline')
  @UseGuards(JwtAuthGuard)
  declineInvite(@Param('inviteId') inviteId: string, @CurrentUser() user: { id: string }) {
    return this.teamsService.declineInvite(inviteId, user.id);
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.teamsService.removeMember(id, user.id, userId);
  }
}
