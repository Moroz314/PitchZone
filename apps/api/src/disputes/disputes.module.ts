import { Module } from '@nestjs/common';

import { RolesGuard } from '../auth/roles.guard';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [TournamentsModule],
  controllers: [DisputesController],
  providers: [DisputesService, RolesGuard],
  exports: [DisputesService],
})
export class DisputesModule {}
