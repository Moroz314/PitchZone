import { Module, forwardRef } from '@nestjs/common';

import { TournamentsModule } from '../tournaments/tournaments.module';
import { EscrowService } from './escrow.service';
import { PaymentsController, WalletController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RegistrationDeadlineService } from './registration-deadline.service';
import { PrizePayoutService } from './prize-payout.service';
import { StripeService } from './stripe.service';
import { WalletService } from './wallet.service';
import { WithdrawalService } from './withdrawal.service';

@Module({
  imports: [forwardRef(() => TournamentsModule)],
  controllers: [PaymentsController, WalletController],
  providers: [
    PaymentsService,
    StripeService,
    EscrowService,
    WalletService,
    RegistrationDeadlineService,
    PrizePayoutService,
    WithdrawalService,
  ],
  exports: [
    PaymentsService,
    EscrowService,
    WalletService,
    RegistrationDeadlineService,
    PrizePayoutService,
    WithdrawalService,
  ],
})
export class PaymentsModule {}
