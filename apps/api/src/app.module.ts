import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { TeamsModule } from './teams/teams.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { MatchesModule } from './matches/matches.module';
import { DisputesModule } from './disputes/disputes.module';
import { AdminModule } from './admin/admin.module';
import { ClubsModule } from './clubs/clubs.module';
import { TransfersModule } from './transfers/transfers.module';
import { ContractsModule } from './contracts/contracts.module';
import { FallbackModule } from './fallback/fallback.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SeasonsModule } from './seasons/seasons.module';
import { StatsModule } from './stats/stats.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PlayerProfileModule } from './player-profile/player-profile.module';
import { EaSyncModule } from './ea-sync/ea-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    PaymentsModule,
    MatchesModule,
    DisputesModule,
    TournamentsModule,
    AdminModule,
    ClubsModule,
    TransfersModule,
    ContractsModule,
    SeasonsModule,
    StatsModule,
    OnboardingModule,
    PlayerProfileModule,
    EaSyncModule,
    NotificationsModule,
    FallbackModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
