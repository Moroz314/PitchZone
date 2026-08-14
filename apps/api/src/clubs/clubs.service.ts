import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TeamsService } from '../teams/teams.service';
import { CLUB_COLOR_PALETTE } from './constants/club-colors';
import { CreateClubDto } from './dto/create-club.dto';

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly teamsService: TeamsService,
  ) {}

  getColorPalette() {
    return CLUB_COLOR_PALETTE;
  }

  async listKitTemplates() {
    return this.prisma.kitTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(ownerId: string, dto: CreateClubDto) {
    const tag = dto.tag.toUpperCase();
    const tagTaken = await this.prisma.team.findUnique({ where: { tag } });
    if (tagTaken) {
      throw new ConflictException('Сокращение клуба уже занято');
    }

    const template = await this.prisma.kitTemplate.findUnique({
      where: { id: dto.kitTemplateId },
    });
    if (!template) {
      throw new NotFoundException('Шаблон формы не найден');
    }

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        tag,
        country: dto.country,
        countryCode: dto.countryCode?.toUpperCase(),
        vkGroupUrl: dto.vkGroupUrl,
        twitchUrl: dto.twitchUrl,
        youtubeUrl: dto.youtubeUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        accentColor: dto.accentColor,
        kitTemplateId: dto.kitTemplateId,
        ownerId,
        members: {
          create: { userId: ownerId, role: TeamRole.OWNER },
        },
      },
    });

    return this.teamsService.findById(team.id);
  }

  async uploadLogo(teamId: string, userId: string, file: Express.Multer.File) {
    await this.ensureOwner(teamId, userId);
    const url = await this.storage.uploadClubLogo(file, teamId);
    await this.prisma.team.update({ where: { id: teamId }, data: { avatar: url } });
    return { avatar: url };
  }

  async uploadCover(teamId: string, userId: string, file: Express.Multer.File) {
    await this.ensureOwner(teamId, userId);
    const url = await this.storage.uploadClubCover(file, teamId);
    await this.prisma.team.update({ where: { id: teamId }, data: { coverBannerUrl: url } });
    return { coverBannerUrl: url };
  }

  private async ensureOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership || membership.role !== TeamRole.OWNER) {
      throw new ForbiddenException('Только владелец клуба может загружать файлы');
    }
  }
}
