import { Module } from '@nestjs/common';

import { RolesGuard } from '../auth/roles.guard';
import { SeasonsController } from './seasons.controller';
import { AdminSeasonsController } from './admin-seasons.controller';
import { SeasonStandingsService } from './season-standings.service';
import { SeasonsService } from './seasons.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';

@Module({
  controllers: [SeasonsController, AdminSeasonsController],
  providers: [SeasonsService, SeasonStandingsService, PlatformSettingsService, RolesGuard],
  exports: [SeasonsService, SeasonStandingsService],
})
export class SeasonsModule {}
