import { Module, forwardRef } from '@nestjs/common';

import { FallbackModule } from '../fallback/fallback.module';
import { PaymentsModule } from '../payments/payments.module';
import { StatsModule } from '../stats/stats.module';
import { BracketService } from './bracket.service';
import { EloService } from './elo.service';
import { TournamentCompletionService } from './tournament-completion.service';
import { TournamentInvitesService } from './tournament-invites.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentsGateway } from './tournaments.gateway';
import { TournamentsService } from './tournaments.service';

@Module({
  imports: [forwardRef(() => PaymentsModule), StatsModule, FallbackModule],
  controllers: [TournamentsController],
  providers: [
    TournamentsService,
    BracketService,
    TournamentsGateway,
    EloService,
    TournamentCompletionService,
    TournamentInvitesService,
  ],
  exports: [TournamentsService, TournamentsGateway, BracketService, TournamentInvitesService],
})
export class TournamentsModule {}
