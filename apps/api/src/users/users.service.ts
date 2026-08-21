import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        stats: true,
        teamMembers: {
          include: {
            team: { select: { id: true, name: true, tag: true, avatar: true, eaClubLink: { select: { eaClubId: true, needsReverification: true } } } },
          },
        },
      },
    });

    if (!user?.profile) {
      throw new NotFoundException('Игрок не найден');
    }

    const winRate =
      user.stats && user.stats.wins + user.stats.losses > 0
        ? Math.round((user.stats.wins / (user.stats.wins + user.stats.losses)) * 1000) / 10
        : 0;

    const rank = await this.getPlayerRank(user.stats?.rating ?? 1200);

    return {
      id: user.id,
      nickname: user.profile.nickname,
      avatar: user.profile.avatar,
      country: user.profile.country,
      countryCode: user.profile.countryCode,
      bio: user.profile.bio,
      joinedAt: user.createdAt.toISOString().split('T')[0],
      rating: user.stats?.rating ?? 1200,
      cardRating: user.stats?.cardRating ?? 75,
      rank,
      wins: user.stats?.wins ?? 0,
      losses: user.stats?.losses ?? 0,
      winRate,
      tournamentsPlayed: user.stats?.tournamentsPlayed ?? 0,
      totalEarnings: user.stats?.totalEarnings ?? 0,
      teams: user.teamMembers.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        tag: m.team.tag,
        avatar: m.team.avatar,
        role: m.role,
        eaClubId: m.team.eaClubLink?.eaClubId ?? null,
        needsReverification: m.team.eaClubLink?.needsReverification ?? false,
      })),
    };
  }

  async findByNickname(nickname: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { nickname },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundException('Игрок не найден');
    }

    return this.findById(profile.userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.nickname) {
      const taken = await this.prisma.profile.findFirst({
        where: { nickname: dto.nickname, NOT: { userId } },
      });
      if (taken) {
        throw new ConflictException('Никнейм уже занят');
      }
    }

    await this.prisma.profile.update({
      where: { userId },
      data: {
        nickname: dto.nickname,
        avatar: dto.avatar,
        country: dto.country,
        countryCode: dto.countryCode?.toUpperCase(),
        bio: dto.bio,
      },
    });

    return this.findById(userId);
  }

  async getLeaderboard(limit = 20) {
    const stats = await this.prisma.playerStats.findMany({
      orderBy: { rating: 'desc' },
      take: limit,
      include: {
        user: { include: { profile: true } },
      },
    });

    return stats.map((s, index) => ({
      rank: index + 1,
      id: s.userId,
      nickname: s.user.profile?.nickname,
      avatar: s.user.profile?.avatar,
      countryCode: s.user.profile?.countryCode,
      rating: s.rating,
      wins: s.wins,
      losses: s.losses,
    }));
  }

  private async getPlayerRank(rating: number): Promise<number> {
    const count = await this.prisma.playerStats.count({
      where: { rating: { gt: rating } },
    });
    return count + 1;
  }
}
