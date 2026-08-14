import { Module } from '@nestjs/common';

import { GamertagValidatorService } from './gamertag-validator.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, GamertagValidatorService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
