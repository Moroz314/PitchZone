import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentStatus,
  TournamentStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EscrowService } from './escrow.service';
import { StripeService } from './stripe.service';
import { WalletService } from './wallet.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
    private readonly escrow: EscrowService,
    private readonly wallet: WalletService,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
  ) {}

  isMockMode() {
    return !this.stripe.isEnabled() || this.config.get<string>('PAYMENTS_MOCK') === 'true';
  }

  getWebUrl() {
    return this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  }

  async completeEntryPayment(params: {
    participantId: string;
    userId: string;
    stripeSessionId?: string;
    externalPaymentId?: string;
    mock?: boolean;
  }) {
    const participant = await this.prisma.tournamentParticipant.findUnique({
      where: { id: params.participantId },
      include: { tournament: true },
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    if (participant.paymentStatus === PaymentStatus.PAID) {
      return participant;
    }

    if (participant.userId && participant.userId !== params.userId) {
      throw new Error('Unauthorized payment completion');
    }

    if (participant.teamId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: participant.teamId, userId: params.userId },
        },
      });
      if (!membership || !['OWNER', 'CAPTAIN'].includes(membership.role)) {
        throw new Error('Unauthorized payment completion');
      }
    }

    const tournament = participant.tournament;
    const amount = tournament.entryFee;

    await this.prisma.$transaction(async (tx) => {
      await tx.escrowAccount.upsert({
        where: { tournamentId: tournament.id },
        create: { tournamentId: tournament.id, currency: tournament.currency },
        update: {},
      });

      await tx.tournamentParticipant.update({
        where: { id: participant.id },
        data: { paymentStatus: PaymentStatus.PAID },
      });

      await tx.escrowAccount.update({
        where: { tournamentId: tournament.id },
        data: { totalHeld: { increment: amount } },
      });

      const wallet = await tx.wallet.upsert({
        where: { userId: params.userId },
        create: { userId: params.userId, currency: tournament.currency },
        update: {},
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          userId: params.userId,
          walletId: wallet.id,
          type: TransactionType.ENTRY_FEE_HOLD,
          amount,
          currency: tournament.currency,
          relatedTournamentId: tournament.id,
          relatedParticipantId: participant.id,
          status: TransactionStatus.COMPLETED,
          externalPaymentId:
            params.externalPaymentId ?? (params.mock ? `mock_${participant.id}` : undefined),
          stripeSessionId: params.stripeSessionId,
        },
      });
    });

    await this.checkRegistrationCapacity(tournament.id);

    await this.tournamentsService.markPrivateInviteAccepted(
      participant.id,
      params.userId,
    );

    return this.prisma.tournamentParticipant.findUnique({ where: { id: participant.id } });
  }

  async checkRegistrationCapacity(tournamentId: string) {
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

    if (tournament._count.participants >= tournament.maxParticipants) {
      await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.REGISTRATION_CLOSED },
      });
      await this.tournamentsService.autoGenerateBracketInternal(tournamentId);
    }
  }

  async createCheckoutForParticipant(params: {
    participantId: string;
    userId: string;
    tournamentSlug: string;
  }) {
    const participant = await this.prisma.tournamentParticipant.findUnique({
      where: { id: params.participantId },
      include: { tournament: true },
    });

    if (!participant) throw new Error('Participant not found');
    if (participant.paymentStatus === PaymentStatus.PAID) {
      return { alreadyPaid: true as const };
    }

    const tournament = participant.tournament;
    const webUrl = this.getWebUrl();

    if (this.isMockMode()) {
      return {
        requiresPayment: true,
        mockPayment: true,
        participantId: participant.id,
        checkoutUrl: `${webUrl}/tournaments/${params.tournamentSlug}/checkout?participantId=${participant.id}`,
      };
    }

    const session = await this.stripe.createCheckoutSession({
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      participantId: participant.id,
      userId: params.userId,
      amount: tournament.entryFee,
      currency: tournament.currency,
      successUrl: `${webUrl}/tournaments/${params.tournamentSlug}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webUrl}/tournaments/${params.tournamentSlug}/register/cancel?participantId=${participant.id}`,
    });

    await this.prisma.tournamentParticipant.update({
      where: { id: participant.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return {
      requiresPayment: true,
      mockPayment: false,
      participantId: participant.id,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async handleCheckoutCompleted(session: {
    id: string;
    payment_intent?: string | { id: string } | null;
    metadata?: { participantId?: string; userId?: string; tournamentId?: string } | null;
  }) {
    const participantId = session.metadata?.participantId;
    const userId = session.metadata?.userId;

    if (!participantId || !userId) {
      this.logger.warn(`Checkout session ${session.id} missing metadata`);
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    await this.completeEntryPayment({
      participantId,
      userId,
      stripeSessionId: session.id,
      externalPaymentId: paymentIntentId,
    });
  }

  async verifySession(sessionId: string, userId: string) {
    if (this.isMockMode()) {
      const participant = await this.prisma.tournamentParticipant.findFirst({
        where: { stripeCheckoutSessionId: sessionId, userId },
      });
      if (participant?.paymentStatus === PaymentStatus.PAID) {
        return { status: 'paid' as const, participantId: participant.id };
      }
      return { status: 'pending' as const };
    }

    const session = await this.stripe.retrieveSession(sessionId);
    if (session.metadata?.userId !== userId) {
      throw new Error('Session does not belong to user');
    }

    if (session.payment_status === 'paid') {
      await this.handleCheckoutCompleted(session);
      return { status: 'paid' as const, participantId: session.metadata?.participantId };
    }

    return { status: session.payment_status };
  }

  async refundTournament(tournamentId: string, reason: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) return;

    const paidParticipants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, paymentStatus: PaymentStatus.PAID },
    });

    const holdTransactions = await this.prisma.transaction.findMany({
      where: {
        relatedTournamentId: tournamentId,
        type: TransactionType.ENTRY_FEE_HOLD,
        status: TransactionStatus.COMPLETED,
      },
    });

    for (const tx of holdTransactions) {
      if (tx.externalPaymentId && this.stripe.isEnabled() && !tx.externalPaymentId.startsWith('mock_')) {
        try {
          await this.stripe.refundPaymentIntent(tx.externalPaymentId);
        } catch (err) {
          this.logger.error(`Refund failed for ${tx.externalPaymentId}: ${err}`);
        }
      }

      await this.wallet.createTransaction({
        userId: tx.userId,
        type: TransactionType.ENTRY_FEE_REFUND,
        amount: tx.amount,
        currency: tx.currency,
        relatedTournamentId: tournamentId,
        relatedParticipantId: tx.relatedParticipantId ?? undefined,
        status: TransactionStatus.COMPLETED,
        externalPaymentId: tx.externalPaymentId ?? undefined,
      });
    }

    await this.prisma.$transaction([
      this.prisma.tournamentParticipant.updateMany({
        where: { tournamentId, paymentStatus: PaymentStatus.PAID },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      }),
      this.prisma.tournamentParticipant.deleteMany({
        where: { tournamentId, paymentStatus: PaymentStatus.PENDING },
      }),
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.CANCELLED },
      }),
    ]);

    await this.escrow.markRefunded(tournamentId);

    this.logger.log(`Tournament ${tournamentId} cancelled (${reason}), refunded ${paidParticipants.length} participants`);
  }

  async countPaidParticipants(tournamentId: string) {
    return this.prisma.tournamentParticipant.count({
      where: { tournamentId, paymentStatus: PaymentStatus.PAID },
    });
  }
}
