import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { TournamentStatus, AwardCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrizePayoutService } from '../payments/prize-payout.service';
import { EloService } from './elo.service';
import { TournamentsGateway } from './tournaments.gateway';
import { TournamentsService } from './tournaments.service';

@Injectable()
export class TournamentCompletionService {
  private readonly logger = new Logger(TournamentCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => PrizePayoutService))
    private readonly prizePayout: PrizePayoutService,
    private readonly elo: EloService,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
    private readonly gateway: TournamentsGateway,
  ) {}

  async onTournamentFinished(tournamentId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: { include: { team: { include: { members: true } } } },
      },
    });

    if (!tournament) return;

    if (tournament.status === TournamentStatus.FINISHED) {
      this.logger.warn(
        `Повторный вызов finish для уже завершённого турнира tournamentId=${tournamentId}`,
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let calculatedPayouts: any = null;
    try {
      calculatedPayouts = await this.prizePayout.calculatePayouts(tournamentId);
    } catch (err) {
      this.logger.error(`Error calculating payouts for tournament ${tournamentId}:`, err);
      // We shouldn't abort tournament completion, but payout won't happen
    }

    let prizeDistribution: { place: number; percent: number }[] = [];
    if (typeof tournament.prizeDistribution === 'string') {
      try {
        prizeDistribution = JSON.parse(tournament.prizeDistribution);
      } catch (e) {
        this.logger.warn('Failed to parse prizeDistribution', e);
      }
    } else {
      prizeDistribution = tournament.prizeDistribution as unknown as {
        place: number;
        percent: number;
      }[];
    }

    if (!Array.isArray(prizeDistribution) || prizeDistribution.length === 0) {
      prizeDistribution = [{ place: 1, percent: 100 }];
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { status: TournamentStatus.FINISHED, endsAt: new Date() },
        });

        if (calculatedPayouts) {
          await this.prizePayout.executePayouts(tx, calculatedPayouts);
        }

        const awardTemplate = await tx.award.upsert({
          where: { slug: 'tournament-medal' },
          create: {
            slug: 'tournament-medal',
            name: 'Призёр турнира',
            description: 'Выдается за занятие призового места в турнире',
            category: AwardCategory.TEAM,
            iconEmoji: '🏆',
          },
          update: {},
        });

        if (calculatedPayouts?.placements) {
          for (const [participantId, place] of calculatedPayouts.placements) {
            const placeConfig = prizeDistribution.find((d) => d.place === place);
            if (!placeConfig) continue;

            const participant = tournament.participants.find((p) => p.id === participantId);
            if (!participant) continue;

            const awardText = `Занял ${place} место в турнире ${tournament.title}`;

            if (participant.teamId && participant.team) {
              await tx.teamAward.create({
                data: {
                  teamId: participant.teamId,
                  awardId: awardTemplate.id,
                  awardedForText: awardText,
                },
              });

              for (const member of participant.team.members) {
                await tx.userAward.create({
                  data: {
                    userId: member.userId,
                    awardId: awardTemplate.id,
                    awardedForText: awardText,
                  },
                });
              }
            } else if (participant.userId) {
              await tx.userAward.create({
                data: {
                  userId: participant.userId,
                  awardId: awardTemplate.id,
                  awardedForText: awardText,
                },
              });
            }
          }
        }
      });
    } catch (err) {
      this.logger.error(`Failed to commit transaction for tournament ${tournamentId}`, err);
      throw err;
    }

    try {
      await this.elo.recalculateForTournament(tournamentId);
    } catch (err) {
      this.logger.error(`Error calculating Elo for tournament ${tournamentId}:`, err);
    }

    try {
      const detail = await this.tournamentsService.findBySlug(tournament.slug);
      this.gateway.emitTournamentUpdate(detail.slug, detail);

      const sentUserIds = new Set<string>();
      for (const participant of tournament.participants) {
        if (participant.userId && !sentUserIds.has(participant.userId)) {
          await this.notifications.create(participant.userId, {
            type: 'TOURNAMENT_FINISHED',
            title: `Турнир завершен!`,
            message: `Турнир ${tournament.title} завершился. Поздравляем победителей!`,
            link: `/tournaments/${tournament.slug}`,
          });
          sentUserIds.add(participant.userId);
        }
        if (participant.team) {
          for (const member of participant.team.members) {
            if (!sentUserIds.has(member.userId)) {
              await this.notifications.create(member.userId, {
                type: 'TOURNAMENT_FINISHED',
                title: `Турнир завершен!`,
                message: `Турнир ${tournament.title} завершился. Результаты уже доступны.`,
                link: `/tournaments/${tournament.slug}`,
              });
              sentUserIds.add(member.userId);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error notifying/emitting updates for tournament ${tournamentId}:`, err);
    }

    this.logger.log(`Tournament ${tournament.slug} fully completed in single transaction`);
  }
}
