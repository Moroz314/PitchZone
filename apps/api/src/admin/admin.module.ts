import { Module, forwardRef } from '@nestjs/common';

import { RolesGuard } from '../auth/roles.guard';
import { PaymentsModule } from '../payments/payments.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { AdminController, PlatformController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [forwardRef(() => TournamentsModule), forwardRef(() => PaymentsModule)],
  controllers: [AdminController, PlatformController],
  providers: [AdminService, PlatformSettingsService, RolesGuard],
  exports: [PlatformSettingsService],
})
export class AdminModule {}
