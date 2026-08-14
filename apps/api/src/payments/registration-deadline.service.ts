import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PaymentStatus, TournamentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class RegistrationDeadlineService {
  private readonly logger = new Logger(RegistrationDeadlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
  ) {}

  async processExpiredRegistrations() {
    const now = new Date();
    const openTournaments = await this.prisma.tournament.findMany({
      where: {
        status: TournamentStatus.REGISTRATION_OPEN,
        registrationDeadline: { lte: now },
      },
    });

    for (const tournament of openTournaments) {
      await this.processTournamentDeadline(tournament.id);
    }
  }

  async processTournamentDeadline(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: {
          select: {
            participants: { where: { paymentStatus: PaymentStatus.PAID } },
          },
        },
      },
    });

    if (!tournament || tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      return;
    }

    const now = new Date();
    if (!tournament.registrationDeadline || tournament.registrationDeadline > now) {
      return;
    }

    const paidCount = tournament._count.participants;

    if (paidCount < tournament.minParticipants) {
      if (tournament.entryFee === 0) {
        this.logger.log(
          `Registration deadline passed for free tournament ${tournament.slug}: ${paidCount}/${tournament.minParticipants} — keeping open for organizer`,
        );
        await this.prisma.tournament.update({
          where: { id: tournamentId },
          data: { status: TournamentStatus.REGISTRATION_CLOSED },
        });
        return;
      }

      this.logger.log(
        `Cancelling tournament ${tournament.slug}: ${paidCount}/${tournament.minParticipants} participants`,
      );
      await this.paymentsService.refundTournament(tournamentId, 'deadline_not_met');
      return;
    }

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.REGISTRATION_CLOSED },
    });

    await this.prisma.tournamentParticipant.deleteMany({
      where: { tournamentId, paymentStatus: PaymentStatus.PENDING },
    });

    const generated = await this.tournamentsService.autoGenerateBracketInternal(tournamentId);
    if (generated) {
      this.logger.log(`Auto-generated bracket for tournament ${tournament.slug}`);
    }
  }
}
