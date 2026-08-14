import { Injectable } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string, currency = 'RUB') {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, currency },
      update: {},
    });
  }

  async getMe(userId: string) {
    const wallet = await this.getOrCreate(userId);
    return {
      id: wallet.id,
      balance: wallet.balance,
      currency: wallet.currency,
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  async listTransactions(userId: string, limit = 50) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        tournament: { select: { id: true, slug: true, title: true } },
      },
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      withdrawalMethod: t.withdrawalMethod,
      failureReason: t.failureReason,
      tournament: t.tournament
        ? { id: t.tournament.id, slug: t.tournament.slug, title: t.tournament.title }
        : null,
      createdAt: t.createdAt.toISOString(),
      processedAt: t.processedAt?.toISOString(),
    }));
  }

  async createTransaction(data: {
    userId: string;
    walletId?: string;
    type: TransactionType;
    amount: number;
    currency?: string;
    relatedTournamentId?: string;
    relatedParticipantId?: string;
    status?: TransactionStatus;
    externalPaymentId?: string;
    stripeSessionId?: string;
  }) {
    const wallet = await this.getOrCreate(data.userId, data.currency);
    return this.prisma.transaction.create({
      data: {
        userId: data.userId,
        walletId: data.walletId ?? wallet.id,
        type: data.type,
        amount: data.amount,
        currency: data.currency ?? wallet.currency,
        relatedTournamentId: data.relatedTournamentId,
        relatedParticipantId: data.relatedParticipantId,
        status: data.status ?? TransactionStatus.PENDING,
        externalPaymentId: data.externalPaymentId,
        stripeSessionId: data.stripeSessionId,
      },
    });
  }
}
