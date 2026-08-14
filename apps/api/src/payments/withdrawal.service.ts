import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionStatus, TransactionType, WithdrawalMethod } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

const MIN_WITHDRAWAL = 100;

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
  ) {}

  isMockMode() {
    return (
      !this.stripe.isEnabled() || this.config.get<string>('WITHDRAWALS_MOCK') === 'true'
    );
  }

  async requestWithdrawal(userId: string, amount: number, method: WithdrawalMethod) {
    if (amount < MIN_WITHDRAWAL) {
      throw new BadRequestException(`Минимальная сумма вывода — ${MIN_WITHDRAWAL} ₽`);
    }

    const wallet = await this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    if (amount > wallet.balance) {
      throw new BadRequestException('Недостаточно средств на балансе');
    }

    const pending = await this.prisma.transaction.count({
      where: {
        userId,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
      },
    });

    if (pending > 0) {
      throw new BadRequestException('Дождитесь обработки текущего вывода');
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      return tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TransactionType.WITHDRAWAL,
          amount,
          currency: wallet.currency,
          status: TransactionStatus.PENDING,
          withdrawalMethod: method,
        },
      });
    });

    if (this.isMockMode()) {
      await this.processMockWithdrawal(transaction.id);
    } else {
      await this.submitToProvider(transaction.id);
    }

    return this.formatWithdrawal(
      await this.prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id } }),
      await this.prisma.wallet.findUniqueOrThrow({ where: { userId } }),
    );
  }

  private async processMockWithdrawal(transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.status !== TransactionStatus.PENDING) return;

    // Сумма, оканчивающаяся на 13 — симуляция отказа провайдера
    if (tx.amount % 100 === 13) {
      await this.failWithdrawal(transactionId, 'Отклонено платёжным провайдером (mock)');
      return;
    }

    await this.completeWithdrawal(transactionId, `mock_payout_${transactionId}`);
  }

  private async submitToProvider(transactionId: string) {
    // Stripe Connect payout — заглушка до prod-интеграции
    this.logger.warn(`Stripe payout not configured — failing withdrawal ${transactionId}`);
    await this.failWithdrawal(
      transactionId,
      'Вывод через Stripe Connect пока не настроен. Используйте WITHDRAWALS_MOCK=true',
    );
  }

  async completeWithdrawal(transactionId: string, externalPaymentId?: string) {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.COMPLETED,
        externalPaymentId,
        processedAt: new Date(),
        failureReason: null,
      },
    });
  }

  async failWithdrawal(transactionId: string, reason: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.status !== TransactionStatus.PENDING) {
      throw new NotFoundException('Вывод не найден или уже обработан');
    }

    await this.prisma.$transaction(async (prisma) => {
      if (tx.walletId) {
        await prisma.wallet.update({
          where: { id: tx.walletId },
          data: { balance: { increment: tx.amount } },
        });
      }

      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.FAILED,
          failureReason: reason,
          processedAt: new Date(),
        },
      });
    });
  }

  formatWithdrawal(
    tx: {
      id: string;
      amount: number;
      currency: string;
      status: TransactionStatus;
      withdrawalMethod: WithdrawalMethod | null;
      failureReason: string | null;
      createdAt: Date;
      processedAt: Date | null;
    },
    wallet: { balance: number; currency: string },
  ) {
    return {
      transaction: {
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        method: tx.withdrawalMethod,
        failureReason: tx.failureReason,
        createdAt: tx.createdAt.toISOString(),
        processedAt: tx.processedAt?.toISOString(),
      },
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency,
      },
    };
  }
}
