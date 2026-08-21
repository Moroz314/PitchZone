import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlayerPosition, TransferAdStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { POSITION_LABELS } from '../clubs/constants/club-colors';
import { CreateClubTransferAdDto, CreatePlayerTransferAdDto } from './dto/transfer.dto';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlayerAds() {
    const ads = await this.prisma.playerTransferAd.findMany({
      where: { status: TransferAdStatus.ACTIVE },
      include: {
        user: { include: { profile: true, stats: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return ads.map((ad) => this.formatPlayerAd(ad));
  }

  async listClubAds() {
    const ads = await this.prisma.clubTransferAd.findMany({
      where: { status: TransferAdStatus.ACTIVE },
      include: {
        team: { include: { kitTemplate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return ads.map((ad) => this.formatClubAd(ad));
  }

  async createPlayerAd(userId: string, dto: CreatePlayerTransferAdDto) {
    const existing = await this.prisma.playerTransferAd.findFirst({
      where: { userId, status: TransferAdStatus.ACTIVE },
    });
    if (existing) {
      throw new ConflictException('У вас уже есть активное объявление');
    }

    const ad = await this.prisma.playerTransferAd.create({
      data: {
        userId,
        position: dto.position,
        availableDays: dto.availableDays,
        aboutText: dto.aboutText,
      },
      include: { user: { include: { profile: true, stats: true } } },
    });

    return this.formatPlayerAd(ad);
  }

  async closePlayerAd(adId: string, userId: string) {
    const ad = await this.prisma.playerTransferAd.findFirst({
      where: { id: adId, userId },
    });
    if (!ad) throw new NotFoundException('Объявление не найдено');

    await this.prisma.playerTransferAd.update({
      where: { id: adId },
      data: { status: TransferAdStatus.CLOSED },
    });

    return { success: true };
  }

  async createClubAd(teamId: string, userId: string, dto: CreateClubTransferAdDto) {
    await this.ensureCaptainOrOwner(teamId, userId);

    const existing = await this.prisma.clubTransferAd.findFirst({
      where: { teamId, status: TransferAdStatus.ACTIVE },
    });
    if (existing) {
      throw new ConflictException('У клуба уже есть активная вакансия');
    }

    const ad = await this.prisma.clubTransferAd.create({
      data: {
        teamId,
        positionNeeded: dto.positionNeeded,
        requirementsText: dto.requirementsText,
      },
      include: { team: { include: { kitTemplate: true } } },
    });

    return this.formatClubAd(ad);
  }

  async closeClubAd(adId: string, userId: string) {
    const ad = await this.prisma.clubTransferAd.findUnique({
      where: { id: adId },
      include: { team: true },
    });
    if (!ad) throw new NotFoundException('Объявление не найдено');

    await this.ensureCaptainOrOwner(ad.teamId, userId);

    await this.prisma.clubTransferAd.update({
      where: { id: adId },
      data: { status: TransferAdStatus.CLOSED },
    });

    return { success: true };
  }

  getPositions() {
    return Object.entries(POSITION_LABELS).map(([value, label]) => ({ value, label }));
  }

  private async ensureCaptainOrOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership || !['OWNER', 'CAPTAIN'].includes(membership.role)) {
      throw new ForbiddenException('Только капитан или владелец клуба');
    }
  }

  private formatPlayerAd(ad: {
    id: string;
    position: PlayerPosition;
    availableDays: unknown;
    aboutText: string;
    status: TransferAdStatus;
    createdAt: Date;
    user: {
      id: string;
      profile: { nickname: string; avatar: string | null; countryCode: string | null } | null;
      stats: { rating: number } | null;
    };
  }) {
    return {
      id: ad.id,
      position: ad.position,
      positionLabel: POSITION_LABELS[ad.position],
      availableDays: ad.availableDays,
      aboutText: ad.aboutText,
      status: ad.status,
      createdAt: ad.createdAt.toISOString(),
      player: {
        id: ad.user.id,
        nickname: ad.user.profile?.nickname ?? '—',
        avatar: ad.user.profile?.avatar,
        countryCode: ad.user.profile?.countryCode,
        rating: ad.user.stats?.rating ?? 1200,
      },
    };
  }

  private formatClubAd(ad: {
    id: string;
    positionNeeded: PlayerPosition;
    requirementsText: string;
    status: TransferAdStatus;
    createdAt: Date;
    team: {
      id: string;
      name: string;
      tag: string;
      avatar: string | null;
      primaryColor: string;
      secondaryColor: string;
      accentColor: string | null;
      kitTemplateId: string | null;
      kitTemplate: { id: string; name: string } | null;
    };
  }) {
    return {
      id: ad.id,
      positionNeeded: ad.positionNeeded,
      positionLabel: POSITION_LABELS[ad.positionNeeded],
      requirementsText: ad.requirementsText,
      status: ad.status,
      createdAt: ad.createdAt.toISOString(),
      club: {
        id: ad.team.id,
        name: ad.team.name,
        tag: ad.team.tag,
        avatar: ad.team.avatar,
        primaryColor: ad.team.primaryColor,
        secondaryColor: ad.team.secondaryColor,
        accentColor: ad.team.accentColor,
        kitTemplateId: ad.team.kitTemplateId,
        kitTemplateName: ad.team.kitTemplate?.name ?? null,
      },
    };
  }
}
