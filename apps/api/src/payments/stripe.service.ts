import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — payments run in mock mode');
    }
  }

  isEnabled() {
    return this.stripe !== null;
  }

  getPublishableKey() {
    return this.config.get<string>('STRIPE_PUBLISHABLE_KEY') ?? null;
  }

  toStripeAmount(amountRub: number, currency: string) {
    const code = currency.toUpperCase();
    const zeroDecimal = ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
    if (zeroDecimal.includes(code)) return amountRub;
    return amountRub * 100;
  }

  toStripeCurrency(currency: string) {
    return currency.toLowerCase();
  }

  async createCheckoutSession(params: {
    tournamentId: string;
    tournamentTitle: string;
    participantId: string;
    userId: string;
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: this.toStripeCurrency(params.currency),
            unit_amount: this.toStripeAmount(params.amount, params.currency),
            product_data: {
              name: `Взнос: ${params.tournamentTitle}`,
              description: 'Регистрация на турнир PitchZone',
            },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.participantId,
      metadata: {
        tournamentId: params.tournamentId,
        participantId: params.participantId,
        userId: params.userId,
      },
    });
  }

  async retrieveSession(sessionId: string) {
    if (!this.stripe) throw new Error('Stripe is not configured');
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    if (!this.stripe) throw new Error('Stripe is not configured');
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async refundPaymentIntent(paymentIntentId: string) {
    if (!this.stripe) throw new Error('Stripe is not configured');
    return this.stripe.refunds.create({ payment_intent: paymentIntentId });
  }
}
