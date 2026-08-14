import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateSettingsDto } from './dto/admin.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });

    return {
      defaultPlatformCommissionPercent: settings.defaultPlatformCommissionPercent,
      privateTournamentCreationFee: settings.privateTournamentCreationFee,
      lanQualifyTopN: settings.lanQualifyTopN,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async updateSettings(dto: AdminUpdateSettingsDto) {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        defaultPlatformCommissionPercent: dto.defaultPlatformCommissionPercent ?? 10,
        privateTournamentCreationFee: dto.privateTournamentCreationFee ?? 0,
      },
      update: {
        defaultPlatformCommissionPercent: dto.defaultPlatformCommissionPercent,
        privateTournamentCreationFee: dto.privateTournamentCreationFee,
        lanQualifyTopN: dto.lanQualifyTopN,
      },
    });

    return {
      defaultPlatformCommissionPercent: settings.defaultPlatformCommissionPercent,
      privateTournamentCreationFee: settings.privateTournamentCreationFee,
      lanQualifyTopN: settings.lanQualifyTopN,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}
