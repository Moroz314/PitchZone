import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CalculateAnnualDto,
  CreateSeasonDto,
  SetPromotionRulesDto,
  UpdateSeasonDto,
  UpdateSeasonEntryDto,
} from './dto/season.dto';
import { SeasonsService } from './seasons.service';

@Controller('admin/seasons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Get()
  list() {
    return this.seasons.adminList();
  }

  @Post()
  create(@Body() dto: CreateSeasonDto) {
    return this.seasons.adminCreate(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSeasonDto) {
    return this.seasons.adminUpdate(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.seasons.adminDelete(id);
  }

  @Post(':id/promotion-rules')
  setPromotionRules(@Param('id') id: string, @Body() dto: SetPromotionRulesDto) {
    return this.seasons.adminSetPromotionRules(id, dto);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string) {
    return this.seasons.adminFinishSeason(id);
  }

  @Patch(':id/entries/:entryId')
  updateEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateSeasonEntryDto,
  ) {
    return this.seasons.adminUpdateEntry(id, entryId, dto);
  }

  @Post('calculate-annual')
  calculateAnnual(@Body() dto: CalculateAnnualDto) {
    return this.seasons.adminCalculateAnnual(dto);
  }
}
