import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
  Headers,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { WalletService } from './wallet.service';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
    private readonly wallet: WalletService,
  ) {}

  @Get('config')
  getConfig() {
    return {
      stripeEnabled: this.stripe.isEnabled(),
      mockMode: this.payments.isMockMode(),
      publishableKey: this.stripe.getPublishableKey(),
    };
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!this.stripe.isEnabled()) {
      return { received: false, reason: 'stripe_disabled' };
    }

    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing webhook payload or signature');
    }

    try {
      const event = this.stripe.constructWebhookEvent(rawBody, signature);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await this.payments.handleCheckoutCompleted(session);
      }

      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook error: ${err}`);
      throw new BadRequestException('Webhook verification failed');
    }
  }

  @Get('session/:sessionId/status')
  @UseGuards(JwtAuthGuard)
  verifySession(@Param('sessionId') sessionId: string, @CurrentUser() user: { id: string }) {
    return this.payments.verifySession(sessionId, user.id);
  }

  @Post('mock/complete/:participantId')
  @UseGuards(JwtAuthGuard)
  async mockComplete(@Param('participantId') participantId: string, @CurrentUser() user: { id: string }) {
    if (!this.payments.isMockMode()) {
      throw new ForbiddenException('Mock payments disabled');
    }

    await this.payments.completeEntryPayment({
      participantId,
      userId: user.id,
      mock: true,
    });

    return { success: true };
  }
}

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly withdrawals: WithdrawalService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyWallet(@CurrentUser() user: { id: string }) {
    return this.wallet.getMe(user.id);
  }

  @Get('me/transactions')
  @UseGuards(JwtAuthGuard)
  getMyTransactions(@CurrentUser() user: { id: string }) {
    return this.wallet.listTransactions(user.id);
  }

  @Post('me/withdraw')
  @UseGuards(JwtAuthGuard)
  withdraw(@CurrentUser() user: { id: string }, @Body() dto: WithdrawDto) {
    return this.withdrawals.requestWithdrawal(user.id, dto.amount, dto.method);
  }

  @Get('config')
  getWithdrawConfig() {
    return { mockMode: this.withdrawals.isMockMode(), minAmount: 100 };
  }
}
