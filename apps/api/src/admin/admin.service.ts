import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EscrowStatus,
  TournamentStatus,
  TournamentVisibility,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { WithdrawalService } from '../payments/withdrawal.service';
import {
  AdminUpdateSettingsDto,
  AdminUpdateTournamentStatusDto,
  AdminUpdateUserDto,
} from './dto/admin.dto';
import { PlatformSettingsService } from './platform-settings.service';

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

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentsService: TournamentsService,
    private readonly paymentsService: PaymentsService,
    private readonly settingsService: PlatformSettingsService,
    private readonly withdrawalService: WithdrawalService,
  ) {}

  async getOverview() {
    const [
      usersCount,
      tournamentsPendingModeration,
      tournamentsLive,
      openDisputes,
      escrowAgg,
      commissionAgg,
      pendingWithdrawals,
      totalWithdrawn,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tournament.count({ where: { status: TournamentStatus.PENDING_MODERATION } }),
      this.prisma.tournament.count({ where: { status: TournamentStatus.LIVE } }),
      this.prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
      this.prisma.escrowAccount.aggregate({
        where: { status: EscrowStatus.HOLDING },
        _sum: { totalHeld: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PLATFORM_COMMISSION, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.count({
        where: { type: TransactionType.WITHDRAWAL, status: TransactionStatus.PENDING },
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.WITHDRAWAL, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
    ]);

    const settings = await this.settingsService.getSettings();

    return {
      usersCount,
      tournamentsPendingModeration,
      tournamentsLive,
      openDisputes,
      escrow: {
        accounts: escrowAgg._count,
        totalHeld: escrowAgg._sum.totalHeld ?? 0,
      },
      platformCommission: {
        total: commissionAgg._sum.amount ?? 0,
        transactions: commissionAgg._count,
      },
      withdrawals: {
        pending: pendingWithdrawals,
        completedTotal: totalWithdrawn._sum.amount ?? 0,
      },
      settings,
    };
  }

  async listUsers(params: { search?: string; role?: UserRole; skip?: number; take?: number }) {
    const take = Math.min(params.take ?? 50, 100);
    const skip = params.skip ?? 0;

    const where = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { profile: { nickname: { contains: params.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: true,
          stats: true,
          wallet: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      total,
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        nickname: u.profile?.nickname ?? '—',
        role: u.role,
        isVerified: u.isVerified,
        canCreateTournaments: u.canCreateTournaments,
        rating: u.stats?.rating ?? 1200,
        walletBalance: u.wallet?.balance ?? 0,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  async updateUser(adminId: string, userId: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (userId === adminId && dto.role && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('Нельзя понизить собственную роль администратора');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: dto.role,
        isVerified: dto.isVerified,
        isStatTracker: dto.isStatTracker,
        canCreateTournaments: dto.canCreateTournaments,
      },
      include: { profile: true, stats: true, wallet: true },
    });

    return {
      id: updated.id,
      email: updated.email,
      nickname: updated.profile?.nickname ?? '—',
      role: updated.role,
      isVerified: updated.isVerified,
      canCreateTournaments: updated.canCreateTournaments,
      rating: updated.stats?.rating ?? 1200,
      walletBalance: updated.wallet?.balance ?? 0,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async listTournaments(params: {
    status?: TournamentStatus;
    visibility?: TournamentVisibility;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(params.take ?? 50, 100);
    const skip = params.skip ?? 0;

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.visibility ? { visibility: params.visibility } : {}),
    };

    const [tournaments, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        include: {
          organizer: { include: { profile: true } },
          _count: { select: { participants: true } },
          escrow: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      total,
      items: tournaments.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        status: STATUS_TO_WEB[t.status],
        statusKey: t.status,
        visibility: t.visibility,
        organizer: {
          id: t.organizerId,
          nickname: t.organizer.profile?.nickname ?? '—',
        },
        prizePool: t.prizePool,
        entryFee: t.entryFee,
        platformCommissionPercent: t.platformCommissionPercent,
        participants: t._count.participants,
        maxParticipants: t.maxParticipants,
        escrowHeld: t.escrow?.totalHeld ?? 0,
        escrowStatus: t.escrow?.status ?? null,
        startsAt: t.startsAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  }

  async approveTournament(tournamentId: string, adminId: string) {
    return this.tournamentsService.approve(tournamentId, adminId);
  }

  async updateTournamentStatus(tournamentId: string, dto: AdminUpdateTournamentStatusDto) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: dto.status },
      include: {
        organizer: { include: { profile: true } },
        _count: { select: { participants: true } },
        escrow: true,
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      status: STATUS_TO_WEB[updated.status],
      statusKey: updated.status,
    };
  }

  async cancelTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    if (
      tournament.status === TournamentStatus.LIVE ||
      tournament.status === TournamentStatus.FINISHED
    ) {
      throw new BadRequestException('Нельзя отменить турнир после старта');
    }

    await this.paymentsService.refundTournament(tournamentId, 'admin_cancelled');
    return { success: true, slug: tournament.slug };
  }

  async deleteTournament(tournamentId: string, adminId: string) {
    return this.tournamentsService.delete(tournamentId, adminId);
  }

  async getFinanceSummary() {
    const [
      commissionByType,
      escrowAccounts,
      recentCommissions,
      withdrawalStats,
      entryFeeStats,
      prizeStats,
    ] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.escrowAccount.findMany({
        where: { status: EscrowStatus.HOLDING },
        include: {
          tournament: { select: { id: true, slug: true, title: true, status: true } },
        },
        orderBy: { totalHeld: 'desc' },
        take: 20,
      }),
      this.prisma.transaction.findMany({
        where: { type: TransactionType.PLATFORM_COMMISSION, status: TransactionStatus.COMPLETED },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          tournament: { select: { slug: true, title: true } },
          user: { include: { profile: true } },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: { type: TransactionType.WITHDRAWAL },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.ENTRY_FEE_HOLD, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PRIZE_PAYOUT, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
    ]);

    const byType = Object.fromEntries(
      commissionByType.map((row) => [row.type, { total: row._sum.amount ?? 0, count: row._count }]),
    );

    return {
      byType,
      entryFeesHeld: entryFeeStats._sum.amount ?? 0,
      prizesPaid: prizeStats._sum.amount ?? 0,
      platformCommissionTotal: byType[TransactionType.PLATFORM_COMMISSION]?.total ?? 0,
      escrowAccounts: escrowAccounts.map((e) => ({
        tournamentId: e.tournamentId,
        slug: e.tournament.slug,
        title: e.tournament.title,
        tournamentStatus: e.tournament.status,
        totalHeld: e.totalHeld,
        status: e.status,
        currency: e.currency,
      })),
      recentCommissions: recentCommissions.map((t) => ({
        id: t.id,
        amount: t.amount,
        tournament: t.tournament
          ? { slug: t.tournament.slug, title: t.tournament.title }
          : null,
        createdAt: t.createdAt.toISOString(),
      })),
      withdrawals: withdrawalStats.map((w) => ({
        status: w.status,
        total: w._sum.amount ?? 0,
        count: w._count,
      })),
    };
  }

  async listTransactions(params: {
    type?: TransactionType;
    status?: TransactionStatus;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(params.take ?? 50, 100);
    const skip = params.skip ?? 0;

    const where = {
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          user: { include: { profile: true } },
          tournament: { select: { slug: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      total,
      items: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        user: {
          id: t.userId,
          nickname: t.user.profile?.nickname ?? '—',
        },
        tournament: t.tournament
          ? { slug: t.tournament.slug, title: t.tournament.title }
          : null,
        failureReason: t.failureReason,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async listWithdrawals(status?: TransactionStatus) {
    const where = {
      type: TransactionType.WITHDRAWAL,
      ...(status ? { status } : {}),
    };

    const withdrawals = await this.prisma.transaction.findMany({
      where,
      include: {
        user: { include: { profile: true } },
        wallet: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount,
      currency: w.currency,
      status: w.status,
      method: w.withdrawalMethod,
      failureReason: w.failureReason,
      user: {
        id: w.userId,
        nickname: w.user.profile?.nickname ?? '—',
        walletBalance: w.wallet?.balance ?? 0,
      },
      createdAt: w.createdAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
    }));
  }

  async processWithdrawal(transactionId: string, action: 'complete' | 'fail', reason?: string) {
    if (action === 'complete') {
      await this.withdrawalService.completeWithdrawal(transactionId, `admin_payout_${transactionId}`);
      return { success: true, status: TransactionStatus.COMPLETED };
    }

    await this.withdrawalService.failWithdrawal(
      transactionId,
      reason ?? 'Отклонено администратором',
    );
    return { success: true, status: TransactionStatus.FAILED };
  }

  getSettings() {
    return this.settingsService.getSettings();
  }

  updateSettings(dto: AdminUpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  assertAdmin(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } }).then((user) => {
      if (!user || user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Только администратор');
      }
      return user;
    });
  }
}
