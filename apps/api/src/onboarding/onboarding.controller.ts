import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  CompleteOnboardingProfileDto,
  CreatePickupMatchDto,
  RegisterPickupMatchDto,
} from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('steps')
  getSteps() {
    return this.onboarding.getSteps();
  }

  @Get('pickup-matches')
  @UseGuards(OptionalJwtAuthGuard)
  listPickupMatches(@CurrentUser() user?: { id: string } | null) {
    return this.onboarding.listPickupMatches(user?.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProgress(@CurrentUser() user: { id: string }) {
    return this.onboarding.getProgress(user.id);
  }

  @Get('me/gamertag-history')
  @UseGuards(JwtAuthGuard)
  getGamertagHistory(@CurrentUser() user: { id: string }) {
    return this.onboarding.getGamertagHistory(user.id);
  }

  @Post('me/profile')
  @UseGuards(JwtAuthGuard)
  completeProfile(@CurrentUser() user: { id: string }, @Body() dto: CompleteOnboardingProfileDto) {
    return this.onboarding.completeProfile(user.id, dto);
  }

  @Post('me/transfers-visited')
  @UseGuards(JwtAuthGuard)
  markTransfersVisited(@CurrentUser() user: { id: string }) {
    return this.onboarding.markTransfersVisited(user.id);
  }

  @Post('pickup-matches')
  @UseGuards(JwtAuthGuard)
  createPickupMatch(
    @CurrentUser() user: { id: string; role?: string },
    @Body() dto: CreatePickupMatchDto,
  ) {
    return this.onboarding.createPickupMatch(user.id, user.role as never, dto);
  }

  @Post('pickup-matches/:id/register')
  @UseGuards(JwtAuthGuard)
  registerPickup(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPickupMatchDto,
  ) {
    return this.onboarding.registerPickupMatch(user.id, id, dto);
  }

  @Delete('pickup-matches/:id/register')
  @UseGuards(JwtAuthGuard)
  leavePickup(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.onboarding.leavePickupMatch(user.id, id);
  }
}
