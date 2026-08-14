import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';

import { PrizePayoutService } from '../payments/prize-payout.service';
import { EloService } from './elo.service';
import { TournamentsGateway } from './tournaments.gateway';
import { TournamentsService } from './tournaments.service';

@Injectable()
export class TournamentCompletionService {
  private readonly logger = new Logger(TournamentCompletionService.name);

  constructor(
    @Inject(forwardRef(() => PrizePayoutService))
    private readonly prizePayout: PrizePayoutService,
    private readonly elo: EloService,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
    private readonly gateway: TournamentsGateway,
  ) {}

  async onTournamentFinished(tournamentId: string): Promise<void> {
    try {
      await this.prizePayout.distribute(tournamentId);
      await this.elo.recalculateForTournament(tournamentId);

      const tournament = await this.tournamentsService.findById(tournamentId);
      const detail = await this.tournamentsService.findBySlug(tournament.slug);

      this.gateway.emitTournamentUpdate(detail.slug, detail);
      this.logger.log(`Tournament ${detail.slug} completed: payouts and Elo updated`);
    } catch (err) {
      this.logger.error(`Failed to complete tournament ${tournamentId}`, err);
      throw err;
    }
  }
}
