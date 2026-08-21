import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  GameTitle,
  MatchStatus,
  ParticipantType,
  PaymentStatus,
  PrizePoolType,
  TournamentFormat,
  TournamentStatus,
  TournamentVisibility,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { TournamentStatsService } from '../stats/tournament-stats.service';
import { EscrowService } from '../payments/escrow.service';
import { PaymentsService } from '../payments/payments.service';
import { RegistrationDeadlineService } from '../payments/registration-deadline.service';
import { BracketService } from './bracket.service';
import { TournamentsGateway } from './tournaments.gateway';
import {
  CreateTournamentDto,
  RegisterTournamentDto,
  UpdateMatchDto,
  UpdateTournamentDto,
} from './dto/tournament.dto';
import { TournamentInvitesService } from './tournament-invites.service';
import { userCanCreateTournaments } from '../auth/tournament-permissions';

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  SINGLE_ELIMINATION: 'Single Elimination',
  DOUBLE_ELIMINATION: 'Double Elimination',
  ROUND_ROBIN: 'Round Robin',
  SWISS: 'Swiss System',
};

const GAME_LABELS: Record<GameTitle, string> = {
  EA_FC: 'EA FC 25',
  EFOOTBALL: 'eFootball 2026',
  OTHER: 'Другое',
};

const STATUS_TO_WEB: Record<TournamentStatus, string> = {
  DRAFT: 'draft',
  PENDING_MODERATION: 'pending_moderation',
  REGISTRATION_OPEN: 'registration_open',
  REGISTRATION_CLOSED: 'registration_closed',
  BRACKET_GENERATED: 'bracket_generated',
  LIVE: 'live',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
};

type PrizeDistribution = { place: number; percent: number }[];

const PAID_PARTICIPANTS = { where: { paymentStatus: PaymentStatus.PAID } };

export type RegisterResult =
  | { requiresPayment: false; tournament: Awaited<ReturnType<TournamentsService['findBySlug']>> }
  | {
      requiresPayment: true;
      mockPayment?: boolean;
      checkoutUrl: string | null;
      sessionId?: string;
      participantId: string;
    };

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BracketService))
    private readonly bracketService: BracketService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly escrowService: EscrowService,
    @Inject(forwardRef(() => RegistrationDeadlineService))
    private readonly deadlineService: RegistrationDeadlineService,
    private readonly gateway: TournamentsGateway,
    private readonly invitesService: TournamentInvitesService,
    private readonly statsService: StatsService,
    private readonly tournamentStatsService: TournamentStatsService,
  ) {}

  async findAll(status?: TournamentStatus, organizerId?: string) {
    await this.deadlineService.processExpiredRegistrations();

    const tournaments = await this.prisma.tournament.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(organizerId
          ? { organizerId }
          : { visibility: TournamentVisibility.PUBLIC, status: { not: TournamentStatus.DRAFT } }),
      },
      include: { _count: { select: { participants: PAID_PARTICIPANTS } } },
      orderBy: { startsAt: 'asc' },
    });

    return tournaments.map((t) => this.formatListItem(t));
  }

  async findMyTournaments(organizerId: string) {
    const tournaments = await this.prisma.tournament.findMany({
      where: { organizerId },
      include: { _count: { select: { participants: PAID_PARTICIPANTS } } },
      orderBy: { updatedAt: 'desc' },
    });

    return tournaments.map((t) => this.formatListItem(t));
  }

  async findBySlug(slug: string, userId?: string, inviteToken?: string) {
    const existing = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      await this.deadlineService.processTournamentDeadline(existing.id);
      await this.autoGenerateBracketInternal(existing.id);
      await this.bracketService.processConfirmationTimeouts(existing.id);
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        _count: { select: { participants: PAID_PARTICIPANTS } },
        participants: {
          where: { paymentStatus: PaymentStatus.PAID },
          include: {
            user: { include: { profile: true, stats: true } },
            team: true,
          },
          orderBy: { seed: 'asc' },
        },
        matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
        escrow: true,
        invites: {
          include: {
            invitedUser: { include: { profile: true } },
            invitedTeam: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tournament) throw new NotFoundException('Турнир не найден');

    let captainTeamIds: string[] = [];
    if (userId) {
      const memberships = await this.prisma.teamMember.findMany({
        where: { userId, role: { in: ['OWNER', 'CAPTAIN'] } },
        select: { teamId: true },
      });
      captainTeamIds = memberships.map((m) => m.teamId);
    }

    const access = await this.invitesService.resolvePrivateAccess({
      tournament,
      userId,
      inviteToken,
      teamIds: captainTeamIds,
    });

    const isOrganizer = userId === tournament.organizerId;
    const detail = this.formatDetail(tournament, {
      access,
      inviteLink:
        isOrganizer && tournament.visibility === TournamentVisibility.PRIVATE && tournament.inviteToken
          ? this.buildInviteLink(tournament.slug, tournament.inviteToken)
          : null,
      invites:
        isOrganizer && tournament.visibility === TournamentVisibility.PRIVATE
          ? tournament.invites.map((invite) => ({
              id: invite.id,
              status: invite.status,
              createdAt: invite.createdAt.toISOString(),
              user: invite.invitedUser
                ? {
                    id: invite.invitedUser.id,
                    nickname: invite.invitedUser.profile?.nickname ?? 'Unknown',
                  }
                : null,
              team: invite.invitedTeam
                ? {
                    id: invite.invitedTeam.id,
                    name: invite.invitedTeam.name,
                    tag: invite.invitedTeam.tag,
                  }
                : null,
            }))
          : undefined,
    });

    return detail;
  }

  async findById(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } },
    });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    return this.formatListItem(tournament);
  }

  async create(organizerId: string, dto: CreateTournamentDto) {
    const organizer = await this.prisma.user.findUnique({ where: { id: organizerId } });
    if (!organizer) throw new NotFoundException('Пользователь не найден');
    if (!userCanCreateTournaments(organizer)) {
      throw new ForbiddenException('Недостаточно прав для создания турниров');
    }

    const slug = dto.slug ?? slugify(dto.title);

    const existing = await this.prisma.tournament.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Slug уже занят');

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date(Date.now() + 7 * 86400000);

    const tournament = await this.prisma.tournament.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        game: dto.game ?? GameTitle.EA_FC,
        format: dto.format ?? TournamentFormat.SINGLE_ELIMINATION,
        matchFormat: dto.matchFormat,
        teamSize: dto.teamSize ?? 1,
        status: TournamentStatus.DRAFT,
        prizePoolType: dto.prizePoolType ?? PrizePoolType.FROM_FEES,
        entryFee: dto.entryFee ?? 0,
        fixedPrizePool: dto.fixedPrizePool,
        platformCommissionPercent: dto.platformCommissionPercent ?? 10,
        prizeDistribution: (dto.prizeDistribution ?? [{ place: 1, percent: 100 }]) as object,
        maxParticipants: dto.maxParticipants ?? 8,
        minParticipants: dto.minParticipants ?? 2,
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : undefined,
        rulesText: dto.rulesText,
        proofRequirement: dto.proofRequirement,
        visibility: dto.visibility ?? TournamentVisibility.PUBLIC,
        startsAt,
        bannerGradient: dto.bannerGradient ?? 'from-accent/20 via-accent-cyan/10 to-transparent',
        organizerId,
      },
      include: { _count: { select: { participants: true } } },
    });

    return this.formatListItem(tournament);
  }

  async update(id: string, userId: string, dto: UpdateTournamentDto) {
    const tournament = await this.ensureOrganizer(id, userId);

    if (tournament.status === TournamentStatus.FINISHED) {
      throw new ConflictException('Завершённый турнир нельзя редактировать');
    }

    const [paidCount, matchCount] = await Promise.all([
      this.paymentsService.countPaidParticipants(id),
      this.prisma.match.count({ where: { tournamentId: id } }),
    ]);

    const structuralLocked =
      matchCount > 0 ||
      tournament.status === TournamentStatus.BRACKET_GENERATED ||
      tournament.status === TournamentStatus.LIVE;

    const financialLocked =
      paidCount > 0 ||
      tournament.status === TournamentStatus.LIVE;

    if (structuralLocked) {
      if (dto.format !== undefined && dto.format !== tournament.format) {
        throw new ConflictException('Формат сетки нельзя менять после генерации матчей');
      }
      if (dto.teamSize !== undefined && dto.teamSize !== tournament.teamSize) {
        throw new ConflictException('Размер команды нельзя менять после генерации матчей');
      }
      if (dto.matchFormat !== undefined && dto.matchFormat !== tournament.matchFormat) {
        throw new ConflictException('Формат матча нельзя менять после генерации матчей');
      }
    }

    if (financialLocked) {
      if (dto.entryFee !== undefined && dto.entryFee !== tournament.entryFee) {
        throw new ConflictException('Взнос нельзя менять после оплат участников');
      }
      if (dto.prizePoolType !== undefined && dto.prizePoolType !== tournament.prizePoolType) {
        throw new ConflictException('Тип призового фонда нельзя менять после оплат');
      }
      if (
        dto.platformCommissionPercent !== undefined &&
        dto.platformCommissionPercent !== tournament.platformCommissionPercent
      ) {
        throw new ConflictException('Комиссию нельзя менять после оплат');
      }
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : tournament.startsAt;
    const registrationDeadline = dto.registrationDeadline
      ? new Date(dto.registrationDeadline)
      : tournament.registrationDeadline;

    if (registrationDeadline && registrationDeadline >= startsAt) {
      throw new BadRequestException('Дедлайн регистрации должен быть раньше старта');
    }

    if (
      dto.registrationDeadline &&
      tournament.status === TournamentStatus.REGISTRATION_OPEN &&
      registrationDeadline != null &&
      registrationDeadline <= new Date()
    ) {
      throw new BadRequestException('Дедлайн регистрации должен быть в будущем');
    }

    if (dto.maxParticipants !== undefined && dto.maxParticipants < paidCount) {
      throw new BadRequestException(
        `Максимум участников не может быть меньше уже зарегистрированных (${paidCount})`,
      );
    }

    if (dto.minParticipants !== undefined && dto.maxParticipants !== undefined) {
      if (dto.minParticipants > dto.maxParticipants) {
        throw new BadRequestException('Минимум участников не может превышать максимум');
      }
    }

    if (dto.prizeDistribution) {
      const totalPercent = dto.prizeDistribution.reduce((sum, p) => sum + p.percent, 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        throw new BadRequestException('Сумма процентов призовых должна быть 100%');
      }
    }

    const nextState = {
      title: dto.title ?? tournament.title,
      description: dto.description !== undefined ? dto.description : tournament.description,
      bannerUrl: dto.bannerUrl !== undefined ? dto.bannerUrl : tournament.bannerUrl,
      game: dto.game ?? tournament.game,
      format: dto.format ?? tournament.format,
      matchFormat: dto.matchFormat ?? tournament.matchFormat,
      teamSize: dto.teamSize ?? tournament.teamSize,
      prizePoolType: dto.prizePoolType ?? tournament.prizePoolType,
      entryFee: dto.entryFee ?? tournament.entryFee,
      fixedPrizePool:
        dto.fixedPrizePool !== undefined ? dto.fixedPrizePool : tournament.fixedPrizePool,
      platformCommissionPercent:
        dto.platformCommissionPercent ?? tournament.platformCommissionPercent,
      prizeDistribution:
        dto.prizeDistribution !== undefined
          ? dto.prizeDistribution
          : (tournament.prizeDistribution as PrizeDistribution),
      maxParticipants: dto.maxParticipants ?? tournament.maxParticipants,
      minParticipants: dto.minParticipants ?? tournament.minParticipants,
      startsAt,
      registrationDeadline,
      rulesText: dto.rulesText !== undefined ? dto.rulesText : tournament.rulesText,
      proofRequirement: dto.proofRequirement ?? tournament.proofRequirement,
      visibility: dto.visibility ?? tournament.visibility,
      bannerGradient: dto.bannerGradient !== undefined ? dto.bannerGradient : tournament.bannerGradient,
    };

    const prizePool = this.calculatePrizePool({
      prizePoolType: nextState.prizePoolType,
      entryFee: nextState.entryFee,
      maxParticipants: nextState.maxParticipants,
      platformCommissionPercent: nextState.platformCommissionPercent,
      fixedPrizePool: nextState.fixedPrizePool,
    });

    const shouldReopenRegistration =
      tournament.status === TournamentStatus.REGISTRATION_CLOSED &&
      matchCount === 0 &&
      registrationDeadline != null &&
      registrationDeadline > new Date();

    await this.prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        ...nextState,
        prizeDistribution: nextState.prizeDistribution as object,
        prizePool,
        ...(shouldReopenRegistration ? { status: TournamentStatus.REGISTRATION_OPEN } : {}),
      },
    });

    return this.findBySlug(tournament.slug, userId);
  }

  async publish(id: string, userId: string) {
    const tournament = await this.ensureOrganizer(id, userId);

    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new ConflictException('Опубликовать можно только черновик');
    }

    this.validateForPublish(tournament);

    const organizer = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!organizer) throw new NotFoundException('Пользователь не найден');

    const prizePool = this.calculatePrizePool(tournament);
    const skipModeration =
      organizer.isVerified || tournament.visibility === TournamentVisibility.PRIVATE;
    const nextStatus = skipModeration
      ? TournamentStatus.REGISTRATION_OPEN
      : TournamentStatus.PENDING_MODERATION;

    const updated = await this.prisma.tournament.update({
      where: { id },
      data: {
        status: nextStatus,
        prizePool,
        ...(tournament.visibility === TournamentVisibility.PRIVATE && !tournament.inviteToken
          ? { inviteToken: this.invitesService.generateInviteToken() }
          : {}),
      },
      include: { _count: { select: { participants: PAID_PARTICIPANTS } } },
    });

    await this.escrowService.ensureForTournament(id, tournament.currency);

    return this.formatListItem(updated);
  }

  async approve(id: string, moderatorId: string) {
    const moderator = await this.prisma.user.findUnique({ where: { id: moderatorId } });
    if (!moderator || (moderator.role !== UserRole.MODERATOR && moderator.role !== UserRole.ADMIN)) {
      throw new ForbiddenException('Только модератор может одобрять турниры');
    }

    const tournament = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    if (tournament.status !== TournamentStatus.PENDING_MODERATION) {
      throw new ConflictException('Турнир не ожидает модерации');
    }

    const updated = await this.prisma.tournament.update({
      where: { id },
      data: { status: TournamentStatus.REGISTRATION_OPEN },
      include: { _count: { select: { participants: true } } },
    });

    return this.formatListItem(updated);
  }

  async cancel(id: string, userId: string) {
    const tournament = await this.ensureOrganizer(id, userId);

    if (
      tournament.status === TournamentStatus.LIVE ||
      tournament.status === TournamentStatus.FINISHED
    ) {
      throw new ConflictException('Нельзя отменить турнир после старта');
    }

    await this.paymentsService.refundTournament(id, 'organizer_cancelled');
    return this.findBySlug(tournament.slug);
  }

  async delete(id: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const isOrganizer = tournament.organizerId === userId;
    const isStaff = user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR;

    if (!isOrganizer && !isStaff) {
      throw new ForbiddenException('Нет прав на удаление турнира');
    }

    if (isOrganizer && !isStaff) {
      if (
        tournament.status === TournamentStatus.LIVE ||
        tournament.status === TournamentStatus.FINISHED
      ) {
        throw new ConflictException(
          'Нельзя удалить турнир после старта — обратитесь к администратору',
        );
      }
    }

    const slug = tournament.slug;

    if (
      tournament.status !== TournamentStatus.CANCELLED &&
      tournament.status !== TournamentStatus.FINISHED &&
      tournament.status !== TournamentStatus.DRAFT
    ) {
      const paidCount = await this.paymentsService.countPaidParticipants(id);
      if (paidCount > 0) {
        await this.paymentsService.refundTournament(
          id,
          isStaff ? 'admin_deleted' : 'organizer_deleted',
        );
      }
    }

    await this.deleteTournamentRecords(id);

    return { success: true, slug };
  }

  private async deleteTournamentRecords(tournamentId: string) {
    const matchIds = (
      await this.prisma.match.findMany({
        where: { tournamentId },
        select: { id: true },
      })
    ).map((m) => m.id);

    if (matchIds.length > 0) {
      await this.prisma.eaApiMatchImport.updateMany({
        where: { matchedTournamentMatchId: { in: matchIds } },
        data: { matchedTournamentMatchId: null },
      });

      await this.prisma.match.updateMany({
        where: { tournamentId },
        data: { nextMatchId: null },
      });
    }

    const participantIds = (
      await this.prisma.tournamentParticipant.findMany({
        where: { tournamentId },
        select: { id: true },
      })
    ).map((p) => p.id);

    await this.prisma.transaction.updateMany({
      where: {
        OR: [
          { relatedTournamentId: tournamentId },
          ...(participantIds.length > 0
            ? [{ relatedParticipantId: { in: participantIds } }]
            : []),
        ],
      },
      data: { relatedTournamentId: null, relatedParticipantId: null },
    });

    await this.prisma.tournament.delete({ where: { id: tournamentId } });
  }

  async reopenRegistration(id: string, userId: string, registrationDeadline: string) {
    const tournament = await this.ensureOrganizer(id, userId);

    const matchCount = await this.prisma.match.count({ where: { tournamentId: id } });

    const canReopenCancelled = tournament.status === TournamentStatus.CANCELLED;
    const canReopenClosed =
      tournament.status === TournamentStatus.REGISTRATION_CLOSED && matchCount === 0;

    if (!canReopenCancelled && !canReopenClosed) {
      throw new ConflictException(
        'Переоткрыть регистрацию можно только для отменённого турнира или до генерации сетки',
      );
    }
    if (tournament.entryFee > 0 && canReopenCancelled) {
      throw new ConflictException('Платный турнир после отмены переоткрыть нельзя — создайте новый');
    }

    const deadline = new Date(registrationDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      throw new BadRequestException('Укажите новый дедлайн регистрации в будущем');
    }
    if (deadline >= tournament.startsAt) {
      throw new BadRequestException('Дедлайн регистрации должен быть раньше старта турнира');
    }

    await this.prisma.tournament.update({
      where: { id },
      data: {
        status: TournamentStatus.REGISTRATION_OPEN,
        registrationDeadline: deadline,
      },
    });

    return this.findBySlug(tournament.slug);
  }

  async markPrivateInviteAccepted(participantId: string, userId: string) {
    const participant = await this.prisma.tournamentParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant) return;

    await this.invitesService.markInviteAccepted(
      participant.tournamentId,
      userId,
      participant.teamId ?? undefined,
    );
  }

  async register(tournamentId: string, userId: string, dto: RegisterTournamentDto): Promise<RegisterResult> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new ConflictException('Регистрация закрыта');
    }

    const paidCount = await this.paymentsService.countPaidParticipants(tournamentId);
    if (paidCount >= tournament.maxParticipants) {
      throw new ConflictException('Турнир заполнен');
    }

    await this.invitesService.assertCanRegisterPrivate({
      tournament,
      userId,
      teamId: dto.teamId,
      inviteToken: dto.inviteToken,
    });

    let participantId: string;

    if (dto.teamId || tournament.teamSize > 1) {
      if (!dto.teamId) {
        throw new BadRequestException('Для командного турнира укажите teamId');
      }

      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: dto.teamId, userId } },
      });
      if (!membership || !['OWNER', 'CAPTAIN'].includes(membership.role)) {
        throw new ForbiddenException('Только капитан или владелец команды может регистрировать');
      }

      const eaClubLink = await this.prisma.eaClubLink.findUnique({
        where: { teamId: dto.teamId },
      });
      if (!eaClubLink || !eaClubLink.eaClubId) {
        throw new ConflictException('Привяжите EA-клуб перед регистрацией на турнир. Перейдите в настройки команды.');
      }

      const memberCount = await this.prisma.teamMember.count({ where: { teamId: dto.teamId } });
      if (memberCount < tournament.teamSize) {
        throw new ConflictException(
          `В команде должно быть минимум ${tournament.teamSize} игроков`,
        );
      }

      const existing = await this.prisma.tournamentParticipant.findUnique({
        where: { tournamentId_teamId: { tournamentId, teamId: dto.teamId } },
      });
      if (existing?.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('Команда уже зарегистрирована');
      }
      if (existing) {
        if (existing.paymentStatus === PaymentStatus.REFUNDED) {
          await this.prisma.tournamentParticipant.update({
            where: { id: existing.id },
            data: { paymentStatus: PaymentStatus.PENDING, stripeCheckoutSessionId: null },
          });
        }
        participantId = existing.id;
      } else {
        const created = await this.prisma.tournamentParticipant.create({
          data: {
            tournamentId,
            teamId: dto.teamId,
            type: ParticipantType.TEAM,
            paymentStatus: PaymentStatus.PENDING,
          },
        });
        participantId = created.id;
      }
    } else {
      const existing = await this.prisma.tournamentParticipant.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } },
      });
      if (existing?.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('Вы уже зарегистрированы');
      }
      if (existing) {
        if (existing.paymentStatus === PaymentStatus.REFUNDED) {
          await this.prisma.tournamentParticipant.update({
            where: { id: existing.id },
            data: { paymentStatus: PaymentStatus.PENDING, stripeCheckoutSessionId: null },
          });
        }
        participantId = existing.id;
      } else {
        const created = await this.prisma.tournamentParticipant.create({
          data: {
            tournamentId,
            userId,
            type: ParticipantType.USER,
            paymentStatus: PaymentStatus.PENDING,
          },
        });
        participantId = created.id;
      }
    }

    if (tournament.entryFee <= 0) {
      await this.paymentsService.completeEntryPayment({
        participantId,
        userId,
        mock: true,
      });
      return { requiresPayment: false, tournament: await this.findBySlug(tournament.slug) };
    }

    const checkout = await this.paymentsService.createCheckoutForParticipant({
      participantId,
      userId,
      tournamentSlug: tournament.slug,
    });

    if ('alreadyPaid' in checkout && checkout.alreadyPaid) {
      return { requiresPayment: false, tournament: await this.findBySlug(tournament.slug) };
    }

    return {
      requiresPayment: true,
      mockPayment: checkout.mockPayment,
      checkoutUrl: checkout.checkoutUrl ?? null,
      sessionId: checkout.sessionId,
      participantId: checkout.participantId,
    };
  }

  async unregister(tournamentId: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new ConflictException('Нельзя отменить регистрацию после закрытия');
    }

    const participant = await this.prisma.tournamentParticipant.findFirst({
      where: {
        tournamentId,
        OR: [{ userId }, { team: { members: { some: { userId, role: { in: ['OWNER', 'CAPTAIN'] } } } } }],
      },
    });
    if (!participant) throw new NotFoundException('Вы не зарегистрированы');

    if (participant.paymentStatus === PaymentStatus.PAID && tournament.entryFee > 0) {
      throw new ConflictException(
        'Отмена оплаченной регистрации недоступна — дождитесь отмены турнира организатором',
      );
    }

    await this.prisma.tournamentParticipant.delete({ where: { id: participant.id } });
    return this.findBySlug(tournament.slug);
  }

  async generateBracket(tournamentId: string, userId: string) {
    const tournament = await this.ensureOrganizer(tournamentId, userId);

    if (
      tournament.status !== TournamentStatus.REGISTRATION_OPEN &&
      tournament.status !== TournamentStatus.REGISTRATION_CLOSED &&
      tournament.status !== TournamentStatus.BRACKET_GENERATED
    ) {
      throw new ConflictException('Сетку можно сгенерировать только после регистрации');
    }

    const matches = await this.bracketService.generateBracket(
      tournament.id,
      tournament.format,
      tournament.seedingMode,
    );

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.BRACKET_GENERATED },
    });

    return {
      tournament: await this.findBySlug(tournament.slug),
      matches: matches.map((m) => this.formatMatch(m)),
    };
  }

  /** Called when registration closes — no auth required */
  async autoGenerateBracketInternal(tournamentId: string): Promise<boolean> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { matches: true } } },
    });

    if (!tournament || tournament.status !== TournamentStatus.REGISTRATION_CLOSED) {
      return false;
    }
    if (tournament._count.matches > 0) {
      return false;
    }

    const paidCount = await this.paymentsService.countPaidParticipants(tournamentId);
    if (paidCount < 2) {
      return false;
    }

    await this.bracketService.generateBracket(
      tournament.id,
      tournament.format,
      tournament.seedingMode,
    );

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.BRACKET_GENERATED },
    });

    const detail = await this.findBySlug(tournament.slug);
    this.gateway.emitBracketUpdate(tournament.slug, {
      tournament: detail,
      matches: detail.matches,
    });

    return true;
  }

  async updateSeeds(tournamentId: string, userId: string, seeds: { participantId: string; seed: number }[]) {
    const tournament = await this.ensureOrganizer(tournamentId, userId);

    if (
      tournament.status !== TournamentStatus.REGISTRATION_CLOSED &&
      tournament.status !== TournamentStatus.BRACKET_GENERATED
    ) {
      throw new ConflictException('Посев можно менять только до старта турнира');
    }

    const paidParticipants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, paymentStatus: PaymentStatus.PAID },
    });

    if (seeds.length !== paidParticipants.length) {
      throw new BadRequestException('Укажите посев для всех участников');
    }

    const seedValues = seeds.map((s) => s.seed).sort((a, b) => a - b);
    const expected = paidParticipants.map((_, i) => i + 1);
    if (seedValues.join(',') !== expected.join(',')) {
      throw new BadRequestException('Номера посева должны быть от 1 до N без пропусков');
    }

    for (const entry of seeds) {
      const belongs = paidParticipants.some((p) => p.id === entry.participantId);
      if (!belongs) {
        throw new BadRequestException(`Участник ${entry.participantId} не найден`);
      }
      await this.prisma.tournamentParticipant.update({
        where: { id: entry.participantId },
        data: { seed: entry.seed },
      });
    }

    const matches = await this.bracketService.generateBracket(
      tournament.id,
      tournament.format,
      tournament.seedingMode,
    );

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.BRACKET_GENERATED },
    });

    return {
      tournament: await this.findBySlug(tournament.slug),
      matches: matches.map((m) => this.formatMatch(m)),
    };
  }

  async getBracket(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { participants: PAID_PARTICIPANTS } },
        participants: {
          where: { paymentStatus: PaymentStatus.PAID },
          include: {
            user: { include: { profile: true, stats: true } },
            team: true,
          },
          orderBy: { seed: 'asc' },
        },
        matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
      },
    });

    if (!tournament) throw new NotFoundException('Турнир не найден');

    return {
      tournament: this.formatListItem(tournament),
      participants: tournament.participants.map((p, index) => ({
        id: p.id,
        seed: p.seed ?? index + 1,
        name: p.user?.profile?.nickname ?? p.team?.name ?? 'Unknown',
        rating: p.user?.stats?.rating ?? null,
      })),
      matches: tournament.matches.map((m) => this.formatMatch(m)),
    };
  }

  async startTournament(tournamentId: string, userId: string) {
    const tournament = await this.ensureOrganizer(tournamentId, userId);

    if (tournament.status !== TournamentStatus.BRACKET_GENERATED) {
      throw new ConflictException('Сначала сгенерируйте сетку');
    }

    await this.bracketService.scheduleFirstRound(tournamentId);

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.LIVE },
    });

    return this.findBySlug(tournament.slug);
  }

  async updateMatch(matchId: string, userId: string, dto: UpdateMatchDto) {
    const matchRecord = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!matchRecord) throw new NotFoundException('Матч не найден');

    await this.ensureOrganizer(matchRecord.tournamentId, userId);

    let updated;
    if (dto.score1 !== undefined && dto.score2 !== undefined) {
      updated = await this.bracketService.updateMatchResult(matchId, dto.score1, dto.score2);

      const participants = await this.prisma.tournamentParticipant.findMany({
        where: {
          id: {
            in: [matchRecord.participant1Id, matchRecord.participant2Id].filter(
              (id): id is string => id != null,
            ),
          },
        },
        select: { teamId: true },
      });
      const teamIds = participants.map((p) => p.teamId).filter((id): id is string => id != null);
      await Promise.all(
        teamIds.map((teamId) =>
          this.tournamentStatsService.recalculateTeamTournamentStat(
            matchRecord.tournamentId,
            teamId,
          ),
        ),
      );
    } else {
      updated = await this.prisma.match.update({
        where: { id: matchId },
        data: {
          status: dto.status as MatchStatus | undefined,
          isActive: dto.status === MatchStatus.IN_PROGRESS,
        },
      });

      if (dto.status === MatchStatus.IN_PROGRESS) {
        await this.prisma.match.updateMany({
          where: { tournamentId: matchRecord.tournamentId, id: { not: matchId } },
          data: { isActive: false },
        });
      }
    }

    const tournament = await this.findBySlug(matchRecord.tournament.slug);
    return {
      match: this.formatMatch(updated),
      tournament,
    };
  }

  async setMatchLive(matchId: string, userId: string) {
    return this.updateMatch(matchId, userId, { status: MatchStatus.IN_PROGRESS });
  }

  private validateForPublish(tournament: {
    title: string;
    startsAt: Date;
    registrationDeadline: Date | null;
    maxParticipants: number;
    prizeDistribution: unknown;
    rulesText: string | null;
  }) {
    if (!tournament.registrationDeadline) {
      throw new BadRequestException('Укажите дедлайн регистрации');
    }
    if (tournament.registrationDeadline <= new Date()) {
      throw new BadRequestException('Дедлайн регистрации должен быть в будущем');
    }
    if (tournament.registrationDeadline >= tournament.startsAt) {
      throw new BadRequestException('Дедлайн регистрации должен быть раньше старта');
    }
    if (!tournament.rulesText || tournament.rulesText.length < 10) {
      throw new BadRequestException('Добавьте правила турнира');
    }

    const distribution = tournament.prizeDistribution as PrizeDistribution;
    if (!Array.isArray(distribution) || distribution.length === 0) {
      throw new BadRequestException('Укажите распределение призов');
    }
    const totalPercent = distribution.reduce((sum, p) => sum + p.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new BadRequestException('Сумма процентов призовых должна быть 100%');
    }
  }

  private calculatePrizePool(tournament: {
    prizePoolType: PrizePoolType;
    entryFee: number;
    maxParticipants: number;
    platformCommissionPercent: number;
    fixedPrizePool: number | null;
  }) {
    if (tournament.prizePoolType === PrizePoolType.FIXED_SPONSORED) {
      return tournament.fixedPrizePool ?? 0;
    }

    const gross = tournament.entryFee * tournament.maxParticipants;
    return Math.floor(gross * (1 - tournament.platformCommissionPercent / 100));
  }

  private async ensureOrganizer(tournamentId: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Только организатор может выполнить это действие');
    }
    return tournament;
  }

  private formatListItem(t: {
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    bannerUrl?: string | null;
    game: GameTitle;
    format: TournamentFormat;
    matchFormat?: string;
    teamSize?: number;
    status: TournamentStatus;
    prizePool: number;
    entryFee: number;
    maxParticipants: number;
    minParticipants?: number;
    visibility?: TournamentVisibility;
    registrationDeadline?: Date | null;
    bannerGradient: string | null;
    startsAt: Date;
    organizerId?: string;
    _count?: { participants: number };
  }) {
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description ?? null,
      bannerUrl: t.bannerUrl ?? null,
      game: GAME_LABELS[t.game],
      gameKey: t.game,
      format: FORMAT_LABELS[t.format],
      formatKey: t.format,
      matchFormat: t.matchFormat,
      teamSize: t.teamSize ?? 1,
      prizePool: t.prizePool,
      entryFee: t.entryFee,
      participants: t._count?.participants ?? 0,
      maxParticipants: t.maxParticipants,
      minParticipants: t.minParticipants ?? 2,
      status: STATUS_TO_WEB[t.status],
      visibility: t.visibility ?? TournamentVisibility.PUBLIC,
      registrationDeadline: t.registrationDeadline?.toISOString() ?? null,
      startsAt: t.startsAt.toISOString(),
      bannerGradient: t.bannerGradient ?? 'from-accent/20 to-transparent',
      organizerId: t.organizerId,
    };
  }

  private buildInviteLink(slug: string, inviteToken: string) {
    const webUrl = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    return `${webUrl}/tournaments/${slug}?invite=${inviteToken}`;
  }

  private formatDetail(
    tournament: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    bannerUrl?: string | null;
    game: GameTitle;
    format: TournamentFormat;
    matchFormat: string;
    teamSize: number;
    status: TournamentStatus;
    prizePool: number;
    prizePoolType: PrizePoolType;
    entryFee: number;
    fixedPrizePool?: number | null;
    maxParticipants: number;
    minParticipants: number;
    platformCommissionPercent: number;
    prizeDistribution: unknown;
    rulesText: string | null;
    proofRequirement: string;
    visibility: TournamentVisibility;
    registrationDeadline: Date | null;
    bannerGradient: string | null;
    startsAt: Date;
    organizerId: string;
    _count: { participants: number };
    participants: {
      id: string;
      seed: number | null;
      type: ParticipantType;
      paymentStatus: PaymentStatus;
      placement: number | null;
      prizeAmount: number | null;
      user: { id: string; profile: { nickname: string | null; avatar?: string | null } | null; stats: { rating: number } | null } | null;
      team: { id: string; name: string; tag: string; avatar?: string | null } | null;
    }[];
    escrow?: { totalHeld: number; status: string; currency: string } | null;
    matches: {
      id: string;
      round: number;
      position: number;
      participant1Name: string | null;
      participant2Name: string | null;
      participant1Id: string | null;
      participant2Id: string | null;
      score1: number | null;
      score2: number | null;
      status: MatchStatus;
      isActive: boolean;
    }[];
  },
    extras?: {
      access?: {
        canRegister: boolean;
        hasValidInviteLink: boolean;
        reason: string | null;
        isOrganizer: boolean;
      };
      inviteLink?: string | null;
      invites?: {
        id: string;
        status: string;
        createdAt: string;
        user: { id: string; nickname: string } | null;
        team: { id: string; name: string; tag: string } | null;
      }[];
    },
  ) {
    return {
      ...this.formatListItem(tournament),
      organizerId: tournament.organizerId,
      bannerUrl: tournament.bannerUrl ?? null,
      prizePoolType: tournament.prizePoolType,
      fixedPrizePool: tournament.fixedPrizePool ?? null,
      platformCommissionPercent: tournament.platformCommissionPercent,
      prizeDistribution: tournament.prizeDistribution,
      rulesText: tournament.rulesText,
      proofRequirement: tournament.proofRequirement,
      participantCount: tournament._count.participants,
      access: extras?.access ?? {
        canRegister: tournament.visibility !== TournamentVisibility.PRIVATE,
        hasValidInviteLink: false,
        reason: null,
        isOrganizer: false,
      },
      inviteLink: extras?.inviteLink ?? null,
      invites: extras?.invites,
      participants: tournament.participants.map((p, index) => ({
        id: p.id,
        seed: p.seed ?? index + 1,
        type: p.type,
        name: p.user?.profile?.nickname ?? p.team?.name ?? 'Unknown',
        userId: p.user?.id,
        teamId: p.team?.id,
        teamTag: p.team?.tag,
        avatarUrl: p.team?.avatar ?? p.user?.profile?.avatar ?? null,
        rating: p.user?.stats?.rating ?? null,
        paymentStatus: p.paymentStatus,
        placement: p.placement ?? undefined,
        prizeAmount: p.prizeAmount ?? undefined,
      })),
      leagueTable: this.buildLeagueTable(
        tournament.format,
        tournament.participants,
        tournament.matches,
      ),
      results:
        tournament.status === TournamentStatus.FINISHED
          ? this.buildResults(tournament.participants, tournament.escrow)
          : undefined,
      escrow: tournament.escrow
        ? {
            totalHeld: tournament.escrow.totalHeld,
            status: tournament.escrow.status,
            currency: tournament.escrow.currency,
          }
        : null,
      matches: tournament.matches.map((m) => this.formatMatch(m)),
    };
  }

  private buildLeagueTable(
    format: TournamentFormat,
    participants: {
      id: string;
      user: {
        id: string;
        profile: { nickname: string | null; avatar?: string | null } | null;
      } | null;
      team: { id: string; name: string; tag: string; avatar?: string | null } | null;
    }[],
    matches: {
      round: number;
      participant1Id: string | null;
      participant2Id: string | null;
      score1: number | null;
      score2: number | null;
      status: MatchStatus;
    }[],
  ) {
    const isRoundRobin = format === TournamentFormat.ROUND_ROBIN;
    const hasPlayoff = isRoundRobin && matches.some((m) => m.round > 1);

    const countedMatches = matches.filter((m) => {
      if (m.status !== MatchStatus.COMPLETED) return false;
      if (!m.participant1Id || !m.participant2Id) return false;
      if (isRoundRobin && hasPlayoff && m.round > 1) return false;
      return true;
    });

    type Row = {
      participantId: string;
      name: string;
      teamId?: string;
      userId?: string;
      avatarUrl: string | null;
      matchesPlayed: number;
      wins: number;
      losses: number;
      draws: number;
      goalsFor: number;
      goalsAgainst: number;
      points: number;
    };

    const rows = new Map<string, Row>();

    for (const p of participants) {
      rows.set(p.id, {
        participantId: p.id,
        name: p.user?.profile?.nickname ?? p.team?.name ?? 'Unknown',
        teamId: p.team?.id,
        userId: p.user?.id,
        avatarUrl: p.team?.avatar ?? p.user?.profile?.avatar ?? null,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
    }

    for (const m of countedMatches) {
      const p1 = rows.get(m.participant1Id!);
      const p2 = rows.get(m.participant2Id!);
      if (!p1 || !p2) continue;

      const s1 = m.score1 ?? 0;
      const s2 = m.score2 ?? 0;

      p1.matchesPlayed++;
      p2.matchesPlayed++;
      p1.goalsFor += s1;
      p1.goalsAgainst += s2;
      p2.goalsFor += s2;
      p2.goalsAgainst += s1;

      if (s1 > s2) {
        p1.wins++;
        p1.points += 3;
        p2.losses++;
      } else if (s2 > s1) {
        p2.wins++;
        p2.points += 3;
        p1.losses++;
      } else {
        p1.draws++;
        p2.draws++;
        p1.points += 1;
        p2.points += 1;
      }
    }

    return [...rows.values()]
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.name.localeCompare(b.name, 'ru');
      })
      .map((row, index) => ({
        position: index + 1,
        participantId: row.participantId,
        name: row.name,
        teamId: row.teamId,
        userId: row.userId,
        avatarUrl: row.avatarUrl,
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
      }));
  }

  private buildResults(
    participants: {
      id: string;
      placement: number | null;
      prizeAmount: number | null;
      user: { profile: { nickname: string | null } | null } | null;
      team: { name: string } | null;
    }[],
    escrow?: { status: string } | null,
  ) {
    const standings = participants
      .filter((p) => p.placement != null)
      .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
      .map((p) => ({
        participantId: p.id,
        place: p.placement!,
        name: p.user?.profile?.nickname ?? p.team?.name ?? 'Unknown',
        prizeAmount: p.prizeAmount ?? 0,
      }));

    const totalPaid = standings.reduce((sum, s) => sum + s.prizeAmount, 0);

    return {
      standings,
      totalPaid,
      escrowStatus: escrow?.status ?? 'HOLDING',
    };
  }

  formatMatch(m: {
    id: string;
    round: number;
    position: number;
    participant1Id?: string | null;
    participant2Id?: string | null;
    participant1Name: string | null;
    participant2Name: string | null;
    score1: number | null;
    score2: number | null;
    status: MatchStatus;
    isActive: boolean;
    scheduledAt?: Date | null;
    confirmationDeadline?: Date | null;
    eaSyncStatus?: import('@prisma/client').MatchEaSyncStatus;
    eaSyncNote?: string | null;
    eaMatchId?: string | null;
  }) {
    const statusMap: Record<MatchStatus, string> = {
      SCHEDULED: 'scheduled',
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      AWAITING_CONFIRMATION: 'awaiting_confirmation',
      COMPLETED: 'completed',
      DISPUTED: 'disputed',
      CANCELLED: 'cancelled',
      BYE: 'completed',
    };

    const eaSyncStatusMap: Record<string, string> = {
      AWAITING_EA: 'awaiting_ea',
      SYNCED: 'synced',
      NEEDS_REVIEW: 'needs_review',
      MANUAL: 'manual',
    };

    return {
      id: m.id,
      round: m.round,
      position: m.position,
      participant1Id: m.participant1Id ?? undefined,
      participant2Id: m.participant2Id ?? undefined,
      player1: m.participant1Name ?? 'TBD',
      player2: m.participant2Name ?? 'TBD',
      score1: m.score1 ?? undefined,
      score2: m.score2 ?? undefined,
      status: statusMap[m.status],
      isActive: m.isActive,
      scheduledAt: m.scheduledAt?.toISOString(),
      confirmationDeadline: m.confirmationDeadline?.toISOString(),
      eaSyncStatus: m.eaSyncStatus ? eaSyncStatusMap[m.eaSyncStatus] : undefined,
      eaSyncNote: m.eaSyncNote ?? undefined,
      eaMatchId: m.eaMatchId ?? undefined,
    };
  }

  async getMatchDetail(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { id: true, slug: true, title: true, status: true } },
        playerStats: { select: { userId: true, xpEarned: true } },
      },
    });

    if (!match) throw new NotFoundException('Матч не найден');
    if (!match.participant1Id || !match.participant2Id) {
      throw new NotFoundException('Участники матча не определены');
    }

    const [participant1, participant2, eaImport] = await Promise.all([
      this.prisma.tournamentParticipant.findUnique({
        where: { id: match.participant1Id },
        include: { team: { select: { id: true, name: true, tag: true } } },
      }),
      this.prisma.tournamentParticipant.findUnique({
        where: { id: match.participant2Id },
        include: { team: { select: { id: true, name: true, tag: true } } },
      }),
      this.prisma.eaApiMatchImport.findFirst({
        where: { matchedTournamentMatchId: matchId, importStatus: 'IMPORTED' },
        orderBy: { importedAt: 'desc' },
        select: { rawJson: true },
      }),
    ]);

    const team1 = participant1?.team ?? {
      id: '',
      name: match.participant1Name ?? 'Team 1',
      tag: 'T1',
    };
    const team2 = participant2?.team ?? {
      id: '',
      name: match.participant2Name ?? 'Team 2',
      tag: 'T2',
    };

    const { homeEaPlayers, awayEaPlayers, statsCount } =
      team1.id && team2.id
        ? await this.statsService.buildEaMatchPlayerTables({
            teamAId: team1.id,
            teamBId: team2.id,
            eaImportRawJson: eaImport?.rawJson ?? null,
            dbPlayerStats: match.playerStats,
          })
        : { homeEaPlayers: [], awayEaPlayers: [], statsCount: match.playerStats.length };

    return {
      id: match.id,
      tournament: match.tournament,
      round: match.round,
      match: this.formatMatch(match),
      team1,
      team2,
      score1: match.score1,
      score2: match.score2,
      status: match.status,
      playedAt: match.completedAt?.toISOString() ?? match.scheduledAt?.toISOString() ?? null,
      eaMatchId: match.eaMatchId,
      eaSyncStatus: match.eaSyncStatus,
      eaSyncNote: match.eaSyncNote,
      statsCount,
      team1EaPlayers: homeEaPlayers,
      team2EaPlayers: awayEaPlayers,
    };
  }
}

function slugify(text: string): string {
  return transliterate(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Транслитерация кириллицы для URL-safe slug (Первый турнир → pervyy-turnir). */
function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return text
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
}
