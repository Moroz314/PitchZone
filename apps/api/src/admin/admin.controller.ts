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
import {
  TournamentStatus,
  TournamentVisibility,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import {
  AdminUpdateSettingsDto,
  AdminUpdateTournamentStatusDto,
  AdminUpdateUserDto,
} from './dto/admin.dto';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.admin.getOverview();
  }

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listUsers({
      search,
      role,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.admin.updateUser(user.id, id, dto);
  }

  @Get('tournaments')
  listTournaments(
    @Query('status') status?: TournamentStatus,
    @Query('visibility') visibility?: TournamentVisibility,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listTournaments({
      status,
      visibility,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Post('tournaments/:id/approve')
  approveTournament(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.admin.approveTournament(id, user.id);
  }

  @Patch('tournaments/:id/status')
  updateTournamentStatus(@Param('id') id: string, @Body() dto: AdminUpdateTournamentStatusDto) {
    return this.admin.updateTournamentStatus(id, dto);
  }

  @Post('tournaments/:id/cancel')
  cancelTournament(@Param('id') id: string) {
    return this.admin.cancelTournament(id);
  }

  @Delete('tournaments/:id')
  deleteTournament(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.admin.deleteTournament(id, user.id);
  }

  @Get('finance/summary')
  getFinanceSummary() {
    return this.admin.getFinanceSummary();
  }

  @Get('finance/transactions')
  listTransactions(
    @Query('type') type?: TransactionType,
    @Query('status') status?: TransactionStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listTransactions({
      type,
      status,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('finance/withdrawals')
  listWithdrawals(@Query('status') status?: TransactionStatus) {
    return this.admin.listWithdrawals(status);
  }

  @Post('finance/withdrawals/:id/complete')
  completeWithdrawal(@Param('id') id: string) {
    return this.admin.processWithdrawal(id, 'complete');
  }

  @Post('finance/withdrawals/:id/fail')
  failWithdrawal(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.admin.processWithdrawal(id, 'fail', body.reason);
  }

  @Get('settings')
  getSettings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: AdminUpdateSettingsDto) {
    return this.admin.updateSettings(dto);
  }
}

@Controller('platform')
export class PlatformController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('settings')
  getPublicSettings() {
    return this.settings.getSettings();
  }
}
