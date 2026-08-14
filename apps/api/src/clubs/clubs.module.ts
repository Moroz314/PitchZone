import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { TeamsModule } from '../teams/teams.module';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';

@Module({
  imports: [StorageModule, TeamsModule],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
