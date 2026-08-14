import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  CreateTournamentDto,
  RegisterTournamentDto,
  UpdateMatchDto,
  UpdateTournamentDto,
} from './dto/tournament.dto';
import { CreateTournamentInviteDto } from './dto/tournament-invite.dto';
import { UpdateSeedsDto } from './dto/seeds.dto';
import { TournamentInvitesService } from './tournament-invites.service';
import { TournamentsGateway } from './tournaments.gateway';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly gateway: TournamentsGateway,
    private readonly invitesService: TournamentInvitesService,
  ) {}

  @Get()
  findAll(@Query('status') status?: TournamentStatus) {
    return this.tournamentsService.findAll(status);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: { id: string }) {
    return this.tournamentsService.findMyTournaments(user.id);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(
    @Param('slug') slug: string,
    @Query('invite') inviteToken?: string,
    @CurrentUser() user?: { id: string } | null,
  ) {
    let decoded = slug;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      /* keep raw slug */
    }
    return this.tournamentsService.findBySlug(decoded, user?.id ?? undefined, inviteToken);
  }

  @Get('matches/:matchId/detail')
  getMatchDetail(@Param('matchId') matchId: string) {
    return this.tournamentsService.getMatchDetail(matchId);
  }

  @Get(':id/bracket')
  getBracket(@Param('id') id: string) {
    return this.tournamentsService.getBracket(id);
  }

  @Patch(':id/seeds')
  @UseGuards(JwtAuthGuard)
  async updateSeeds(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateSeedsDto,
  ) {
    const result = await this.tournamentsService.updateSeeds(id, user.id, dto.seeds);
    this.gateway.emitBracketUpdate(result.tournament.slug, result);
    return result;
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tournamentsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateTournamentDto,
  ) {
    const result = await this.tournamentsService.update(id, user.id, dto);
    this.gateway.emitTournamentUpdate(result.slug, result);
    return result;
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.publish(id, user.id);
    this.gateway.emitTournamentUpdate(result.slug, result);
    return result;
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  async approve(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.approve(id, user.id);
    this.gateway.emitTournamentUpdate(result.slug, result);
    return result;
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.cancel(id, user.id);
    this.gateway.emitTournamentUpdate(result.slug, result);
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.tournamentsService.delete(id, user.id);
  }

  @Post(':id/reopen')
  @UseGuards(JwtAuthGuard)
  async reopen(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { registrationDeadline: string },
  ) {
    const result = await this.tournamentsService.reopenRegistration(
      id,
      user.id,
      body.registrationDeadline,
    );
    this.gateway.emitTournamentUpdate(result.slug, result);
    return result;
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  async register(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterTournamentDto,
  ) {
    const result = await this.tournamentsService.register(id, user.id, dto);
    if (!result.requiresPayment) {
      this.gateway.emitTournamentUpdate(result.tournament.slug, result.tournament);
    }
    return result;
  }

  @Get(':id/invites')
  @UseGuards(JwtAuthGuard)
  listInvites(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.invitesService.listInvites(id, user.id);
  }

  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTournamentInviteDto,
  ) {
    return this.invitesService.createInvite(id, user.id, dto);
  }

  @Delete(':id/invites/:inviteId')
  @UseGuards(JwtAuthGuard)
  deleteInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.invitesService.deleteInvite(id, inviteId, user.id);
  }

  @Delete(':id/register')
  @UseGuards(JwtAuthGuard)
  async unregister(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.unregister(id, user.id);
    this.gateway.emitTournamentUpdate(result.slug, result);
    return result;
  }

  @Post(':id/generate-bracket')
  @UseGuards(JwtAuthGuard)
  async generateBracket(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.generateBracket(id, user.id);
    this.gateway.emitBracketUpdate(result.tournament.slug, result);
    return result;
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  async startTournament(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.startTournament(id, user.id);
    this.gateway.emitTournamentUpdate(result.slug, result);
    this.gateway.emitBracketUpdate(result.slug, { tournament: result, matches: result.matches });
    return result;
  }

  @Patch('matches/:matchId')
  @UseGuards(JwtAuthGuard)
  async updateMatch(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateMatchDto,
  ) {
    const result = await this.tournamentsService.updateMatch(matchId, user.id, dto);
    this.gateway.emitMatchUpdate(result.tournament.slug, result);
    return result.match;
  }

  @Post('matches/:matchId/live')
  @UseGuards(JwtAuthGuard)
  async setMatchLive(@Param('matchId') matchId: string, @CurrentUser() user: { id: string }) {
    const result = await this.tournamentsService.setMatchLive(matchId, user.id);
    this.gateway.emitMatchUpdate(result.tournament.slug, result);
    return result.match;
  }
}
