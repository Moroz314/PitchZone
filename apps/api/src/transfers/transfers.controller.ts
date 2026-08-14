import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateClubTransferAdDto, CreatePlayerTransferAdDto } from './dto/transfer.dto';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get('positions')
  getPositions() {
    return this.transfersService.getPositions();
  }

  @Get('players')
  listPlayerAds() {
    return this.transfersService.listPlayerAds();
  }

  @Get('clubs')
  listClubAds() {
    return this.transfersService.listClubAds();
  }

  @Post('players')
  @UseGuards(JwtAuthGuard)
  createPlayerAd(@CurrentUser() user: { id: string }, @Body() dto: CreatePlayerTransferAdDto) {
    return this.transfersService.createPlayerAd(user.id, dto);
  }

  @Delete('players/:id')
  @UseGuards(JwtAuthGuard)
  closePlayerAd(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.transfersService.closePlayerAd(id, user.id);
  }

  @Post('clubs/:teamId')
  @UseGuards(JwtAuthGuard)
  createClubAd(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateClubTransferAdDto,
  ) {
    return this.transfersService.createClubAd(teamId, user.id, dto);
  }

  @Delete('clubs/:id')
  @UseGuards(JwtAuthGuard)
  closeClubAd(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.transfersService.closeClubAd(id, user.id);
  }
}
