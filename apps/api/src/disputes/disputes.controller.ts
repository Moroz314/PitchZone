import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DisputeStatus, UserRole } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ResolveDisputeDto, ReviewDisputeDto } from './dto/resolve-dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  findAll(@Query('status') status?: DisputeStatus) {
    return this.disputesService.findAll(status);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.disputesService.findById(id);
  }

  @Patch(':id/review')
  markUnderReview(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ReviewDisputeDto,
  ) {
    return this.disputesService.markUnderReview(id, user.id, dto.note);
  }

  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(id, user.id, dto);
  }
}
