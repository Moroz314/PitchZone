import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OfferContractDto } from '../transfers/dto/transfer.dto';
import { ContractsService } from './contracts.service';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMyContracts(@CurrentUser() user: { id: string }) {
    return this.contractsService.listMyContracts(user.id);
  }

  @Get('me/active')
  @UseGuards(JwtAuthGuard)
  getMyActiveContract(@CurrentUser() user: { id: string }) {
    return this.contractsService.getActiveContract(user.id);
  }

  @Get('teams/:teamId')
  @UseGuards(JwtAuthGuard)
  listTeamContracts(@Param('teamId') teamId: string, @CurrentUser() user: { id: string }) {
    return this.contractsService.listTeamContracts(teamId, user.id);
  }

  @Post('teams/:teamId/offer')
  @UseGuards(JwtAuthGuard)
  offer(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: OfferContractDto,
  ) {
    return this.contractsService.offer(teamId, user.id, dto);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  accept(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.contractsService.accept(id, user.id);
  }

  @Post(':id/decline')
  @UseGuards(JwtAuthGuard)
  decline(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.contractsService.decline(id, user.id);
  }

  @Post(':id/buyout')
  @UseGuards(JwtAuthGuard)
  buyout(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.contractsService.terminateByBuyout(id, user.id);
  }
}
