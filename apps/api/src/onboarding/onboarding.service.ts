import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PickupMatchStatus, PlayerPosition, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CompleteOnboardingProfileDto,
  CreatePickupMatchDto,
  RegisterPickupMatchDto,
} from './dto/onboarding.dto';
import { GamertagValidatorService } from './gamertag-validator.service';

const ONBOARDING_STEPS = [
  { id: 'register', label: 'Регистрация', description: 'Создайте аккаунт PitchZone' },
  {
    id: 'profile',
    label: 'Профиль и геймертег',
    description: 'Укажите EA FC ник, амплуа и контакты',
  },
  {
    id: 'pickup',
    label: 'Сборные матчи',
    description: 'Сыграйте открытый матч и покажите себя капитанам',
  },
  {
    id: 'transfers',
    label: 'Поиск команды',
    description: 'Разместите объявление в разделе Трансферы',
  },
] as const;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamertagValidator: GamertagValidatorService,
  ) {}

  getSteps() {
    return ONBOARDING_STEPS;
  }

  async getProgress(userId: string) {
    await this.ensureProgress(userId);

    const [progress, profile, pickupCount, transferAd, teamCount] = await Promise.all([
      this.prisma.userOnboardingProgress.findUnique({ where: { userId } }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.pickupMatchRegistration.count({ where: { userId } }),
      this.prisma.playerTransferAd.findFirst({
        where: { userId, status: 'ACTIVE' },
      }),
      this.prisma.teamMember.count({ where: { userId } }),
    ]);

    const profileCompleted = this.isProfileComplete(profile);
    const pickupJoined = (progress?.pickupJoined ?? false) || pickupCount > 0;
    const transfersVisited =
      (progress?.transfersVisited ?? false) || Boolean(transferAd) || teamCount > 0;

    const steps = {
      register: { completed: true },
      profile: { completed: profileCompleted },
      pickup: { completed: pickupJoined, pickupCount },
      transfers: { completed: transfersVisited, hasTeam: teamCount > 0 },
    };

    const allComplete =
      steps.register.completed &&
      steps.profile.completed &&
      steps.pickup.completed &&
      steps.transfers.completed;

    if (allComplete && progress && !progress.completedAt) {
      await this.prisma.userOnboardingProgress.update({
        where: { userId },
        data: {
          profileCompleted: true,
          pickupJoined: true,
          transfersVisited: true,
          completedAt: new Date(),
        },
      });
    } else if (progress) {
      await this.prisma.userOnboardingProgress.update({
        where: { userId },
        data: {
          profileCompleted,
          pickupJoined,
          transfersVisited,
        },
      });
    }

    return {
      steps,
      allComplete,
      profile: profile
        ? {
            gamerTag: profile.gamerTag,
            gamerTagConfirmed: profile.gamerTagConfirmed,
            primaryPosition: profile.primaryPosition,
            countryCode: profile.countryCode,
            city: profile.city,
          }
        : null,
      nextStep: this.resolveNextStep(steps),
    };
  }

  async completeProfile(userId: string, dto: CompleteOnboardingProfileDto) {
    if (!dto.gamerTagConfirmed) {
      throw new BadRequestException('Подтвердите, что геймертег совпадает с EA FC');
    }

    const { normalized, warnings } = this.gamertagValidator.validate(dto.gamerTag);

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Профиль не найден');

    const gamerTagChanged = profile.gamerTag && profile.gamerTag !== normalized;

    await this.prisma.$transaction(async (tx) => {
      if (gamerTagChanged || !profile.gamerTag) {
        if (profile.gamerTag) {
          await tx.gamertagHistory.updateMany({
            where: { userId, validTo: null },
            data: { validTo: new Date() },
          });
        }

        await tx.gamertagHistory.create({
          data: { userId, gamerTag: normalized },
        });
      }

      await tx.profile.update({
        where: { userId },
        data: {
          gamerTag: normalized,
          gamerTagConfirmed: true,
          primaryPosition: dto.primaryPosition,
          country: dto.country,
          countryCode: dto.countryCode?.toUpperCase(),
          city: dto.city,
          vkUrl: dto.vkUrl,
          telegramUrl: dto.telegramUrl,
          discordUsername: dto.discordUsername,
          profileCompletedAt: new Date(),
        },
      });

      await tx.userOnboardingProgress.upsert({
        where: { userId },
        create: { userId, profileCompleted: true },
        update: { profileCompleted: true },
      });
    });

    return {
      success: true,
      gamerTag: normalized,
      warnings,
      progress: await this.getProgress(userId),
    };
  }

  async getGamertagHistory(userId: string) {
    const history = await this.prisma.gamertagHistory.findMany({
      where: { userId },
      orderBy: { validFrom: 'desc' },
    });

    return history.map((h) => ({
      id: h.id,
      gamerTag: h.gamerTag,
      validFrom: h.validFrom.toISOString(),
      validTo: h.validTo?.toISOString() ?? null,
      isCurrent: h.validTo === null,
    }));
  }

  async markTransfersVisited(userId: string) {
    await this.ensureProgress(userId);
    await this.prisma.userOnboardingProgress.update({
      where: { userId },
      data: { transfersVisited: true },
    });
    return this.getProgress(userId);
  }

  async listPickupMatches(userId?: string) {
    const matches = await this.prisma.pickupMatch.findMany({
      where: {
        status: { in: [PickupMatchStatus.OPEN, PickupMatchStatus.FULL] },
        scheduledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        registrations: {
          include: { user: { include: { profile: true } } },
        },
        createdBy: { include: { profile: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    return matches.map((m) => this.formatPickupMatch(m, userId));
  }

  async createPickupMatch(userId: string, userRole: UserRole, dto: CreatePickupMatchDto) {
    if (!['MODERATOR', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Создавать сборные матчи могут модераторы');
    }

    const match = await this.prisma.pickupMatch.create({
      data: {
        title: dto.title,
        description: dto.description,
        scheduledAt: new Date(dto.scheduledAt),
        maxPlayers: dto.maxPlayers ?? 11,
        platform: dto.platform,
        chatUrl: dto.chatUrl,
        createdById: userId,
      },
      include: {
        registrations: { include: { user: { include: { profile: true } } } },
        createdBy: { include: { profile: true } },
      },
    });

    return this.formatPickupMatch(match, userId);
  }

  async registerPickupMatch(userId: string, matchId: string, dto: RegisterPickupMatchDto) {
    const match = await this.prisma.pickupMatch.findUnique({
      where: { id: matchId },
      include: { _count: { select: { registrations: true } } },
    });

    if (!match) throw new NotFoundException('Сборный матч не найден');
    if (match.status === PickupMatchStatus.CANCELLED || match.status === PickupMatchStatus.COMPLETED) {
      throw new BadRequestException('Регистрация на этот матч закрыта');
    }
    if (match._count.registrations >= match.maxPlayers) {
      throw new ConflictException('Мест больше нет');
    }

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!this.isProfileComplete(profile)) {
      throw new BadRequestException('Сначала заполните профиль и подтвердите геймертег');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pickupMatchRegistration.create({
        data: {
          pickupMatchId: matchId,
          userId,
          position: dto.position ?? profile?.primaryPosition ?? undefined,
        },
      });

      const count = await tx.pickupMatchRegistration.count({ where: { pickupMatchId: matchId } });
      if (count >= match.maxPlayers) {
        await tx.pickupMatch.update({
          where: { id: matchId },
          data: { status: PickupMatchStatus.FULL },
        });
      }

      await tx.userOnboardingProgress.upsert({
        where: { userId },
        create: { userId, pickupJoined: true },
        update: { pickupJoined: true },
      });
    });

    return this.getProgress(userId);
  }

  async leavePickupMatch(userId: string, matchId: string) {
    await this.prisma.pickupMatchRegistration.deleteMany({
      where: { pickupMatchId: matchId, userId },
    });

    await this.prisma.pickupMatch.updateMany({
      where: { id: matchId, status: PickupMatchStatus.FULL },
      data: { status: PickupMatchStatus.OPEN },
    });

    return { success: true };
  }

  private async ensureProgress(userId: string) {
    await this.prisma.userOnboardingProgress.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private isProfileComplete(
    profile: {
      gamerTag: string | null;
      gamerTagConfirmed: boolean;
      primaryPosition: PlayerPosition | null;
      countryCode: string | null;
    } | null,
  ) {
    if (!profile) return false;
    return Boolean(
      profile.gamerTag &&
        profile.gamerTagConfirmed &&
        profile.primaryPosition &&
        profile.countryCode,
    );
  }

  private resolveNextStep(steps: {
    register: { completed: boolean };
    profile: { completed: boolean };
    pickup: { completed: boolean };
    transfers: { completed: boolean };
  }) {
    if (!steps.profile.completed) return 'profile';
    if (!steps.pickup.completed) return 'pickup';
    if (!steps.transfers.completed) return 'transfers';
    return null;
  }

  private formatPickupMatch(
    match: {
      id: string;
      title: string;
      description: string | null;
      scheduledAt: Date;
      maxPlayers: number;
      platform: string | null;
      chatUrl: string | null;
      status: PickupMatchStatus;
      registrations: {
        userId: string;
        position: PlayerPosition | null;
        user: { profile: { nickname: string; gamerTag: string | null; primaryPosition: PlayerPosition | null } | null };
      }[];
      createdBy: { profile: { nickname: string } | null };
    },
    userId?: string,
  ) {
    return {
      id: match.id,
      title: match.title,
      description: match.description,
      scheduledAt: match.scheduledAt.toISOString(),
      maxPlayers: match.maxPlayers,
      registeredCount: match.registrations.length,
      platform: match.platform,
      chatUrl: match.chatUrl,
      status: match.status,
      createdByNickname: match.createdBy.profile?.nickname,
      isRegistered: userId ? match.registrations.some((r) => r.userId === userId) : false,
      registrations: match.registrations.map((r) => ({
        userId: r.userId,
        nickname: r.user.profile?.nickname,
        gamerTag: r.user.profile?.gamerTag,
        position: r.position ?? r.user.profile?.primaryPosition,
      })),
    };
  }
}
