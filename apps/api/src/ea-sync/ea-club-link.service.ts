import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateEaClubLinkDto } from './dto/ea-sync.dto';
import { STATS_PROVIDER, StatsProvider } from './providers/stats-provider.interface';

export const ACTIVE_GAME_VERSION = 'FC26';

@Injectable()
export class EaClubLinkService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STATS_PROVIDER) private readonly statsProvider: StatsProvider,
  ) {}

  async getByTeamId(teamId: string) {
    return this.prisma.eaClubLink.findUnique({ where: { teamId } });
  }

  async upsert(teamId: string, userId: string, dto: UpdateEaClubLinkDto) {
    await this.ensureCaptainOrOwner(teamId, userId);

    const eaClubId = dto.eaClubId.trim();
    const clubInfo = await this.statsProvider.verifyClub(eaClubId, dto.platform);
    if (!clubInfo) {
      throw new BadRequestException(`Клуб с ID ${eaClubId} не найден в базе EA. Проверьте правильность ID и платформы.`);
    }

    return this.prisma.eaClubLink.upsert({
      where: { teamId },
      create: {
        teamId,
        eaClubId: eaClubId,
        platform: dto.platform,
        gameVersion: ACTIVE_GAME_VERSION,
        lastVerifiedClubName: clubInfo.name,
        needsReverification: false,
      },
      update: {
        eaClubId: eaClubId,
        platform: dto.platform,
        gameVersion: ACTIVE_GAME_VERSION,
        lastVerifiedClubName: clubInfo.name,
        needsReverification: false,
      },
    });
  }

  async listActiveLinks() {
    const activeSeasons = await this.prisma.season.findMany({
      where: { status: { in: ['ACTIVE', 'REGISTRATION'] } },
      select: { id: true },
    });

    if (activeSeasons.length === 0) return [];

    const seasonIds = activeSeasons.map((s) => s.id);
    const entries = await this.prisma.seasonTeamEntry.findMany({
      where: { seasonId: { in: seasonIds } },
      select: { teamId: true },
    });

    const matchTeams = await this.prisma.seasonMatch.findMany({
      where: { seasonId: { in: seasonIds } },
      select: { homeTeamId: true, awayTeamId: true },
    });

    const teamIds = new Set<string>();
    for (const e of entries) teamIds.add(e.teamId);
    for (const m of matchTeams) {
      teamIds.add(m.homeTeamId);
      teamIds.add(m.awayTeamId);
    }

    return this.prisma.eaClubLink.findMany({
      where: { teamId: { in: [...teamIds] } },
      include: { team: { select: { id: true, name: true, tag: true } } },
    });
  }

  private async ensureCaptainOrOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (
      !membership ||
      (membership.role !== TeamRole.OWNER && membership.role !== TeamRole.CAPTAIN)
    ) {
      throw new ForbiddenException('Только капитан или владелец может настраивать EA Club ID');
    }
  }
}
