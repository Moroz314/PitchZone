import { Module, forwardRef } from '@nestjs/common';

import { PlayerProfileModule } from '../player-profile/player-profile.module';
import { SeasonsModule } from '../seasons/seasons.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { EaClubLinkService } from './ea-club-link.service';
import { EaMatchMatcherService } from './ea-match-matcher.service';
import { EaSyncController } from './ea-sync.controller';
import { EaSyncService } from './ea-sync.service';
import { EaProClubsStatsProvider } from './providers/ea-pro-clubs.provider';
import { STATS_PROVIDER } from './providers/stats-provider.interface';
import { StatsModule } from '../stats/stats.module';

@Module({
  imports: [
    StatsModule,
    SeasonsModule,
    forwardRef(() => TournamentsModule),
    PlayerProfileModule,
  ],
  controllers: [EaSyncController],
  providers: [
    EaSyncService,
    EaClubLinkService,
    EaMatchMatcherService,
    EaProClubsStatsProvider,
    { provide: STATS_PROVIDER, useClass: EaProClubsStatsProvider },
  ],
  exports: [EaSyncService, EaClubLinkService, EaProClubsStatsProvider, STATS_PROVIDER],
})
export class EaSyncModule {}
