import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamInviteStatus, TeamRole } from '@prisma/client';

import { ContractsService } from '../contracts/contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentStatsService } from '../stats/tournament-stats.service';
import { AcceptInviteDto } from './dto/invite-team.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { InviteTeamDto } from './dto/invite-team.dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
    private readonly tournamentStats: TournamentStatsService,
  ) {}

  async create(ownerId: string, dto: CreateTeamDto) {
    const tagTaken = await this.prisma.team.findUnique({ where: { tag: dto.tag.toUpperCase() } });
    if (tagTaken) {
      throw new ForbiddenException('Тег команды уже занят');
    }

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        tag: dto.tag.toUpperCase(),
        country: dto.country,
        countryCode: dto.countryCode?.toUpperCase(),
        description: dto.description,
        ownerId,
        members: {
          create: { userId: ownerId, role: TeamRole.OWNER },
        },
      },
      include: this.teamInclude(),
    });

    return this.formatTeam(team);
  }

  async findById(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: this.teamInclude(),
    });

    if (!team) {
      throw new NotFoundException('Команда не найдена');
    }

    const tournamentStats = await this.tournamentStats.getTeamTournamentStats(id);
    await this.tournamentStats.refreshTeamMembersPlayerStats(id);

    const teamFresh = await this.prisma.team.findUnique({
      where: { id },
      include: this.teamInclude(),
    });
    if (!teamFresh) {
      throw new NotFoundException('Команда не найдена');
    }

    const teamRecord = await this.tournamentStats.getTeamAggregateRecord(id);
    const formatted = this.formatTeam(teamFresh);

    return {
      ...formatted,
      totalWins: teamRecord.wins,
      totalLosses: teamRecord.losses,
      totalDraws: teamRecord.draws,
      tournamentStats: tournamentStats.map((s) => ({
        tournamentId: s.tournamentId,
        tournamentSlug: s.tournament.slug,
        tournamentTitle: s.tournament.title,
        tournamentStatus: s.tournament.status,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  }

  async findByTag(tag: string) {
    const team = await this.prisma.team.findUnique({
      where: { tag: tag.toUpperCase() },
      select: { id: true },
    });

    if (!team) {
      throw new NotFoundException('Команда не найдена');
    }

    return this.findById(team.id);
  }

  async search(query?: string, skip = 0, take = 50) {
    const q = query?.trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { tag: { contains: q.toUpperCase(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip,
        take: Math.min(take, 100),
        orderBy: { name: 'asc' },
        include: {
          kitTemplate: { select: { id: true, name: true } },
          _count: { select: { members: true } },
          members: {
            include: { user: { include: { stats: true } } },
          },
        },
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      total,
      items: teams.map((team) => this.formatClubListItem(team)),
    };
  }

  async listPendingInvites(teamId: string, userId: string) {
    await this.ensureCaptainOrOwner(teamId, userId);

    const invites = await this.prisma.teamInvite.findMany({
      where: { teamId, status: TeamInviteStatus.PENDING, expiresAt: { gt: new Date() } },
      include: { invitee: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((inv) => ({
      id: inv.id,
      inviteeId: inv.inviteeId,
      nickname: inv.invitee.profile?.nickname,
      avatar: inv.invitee.profile?.avatar,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  async invite(teamId: string, inviterId: string, dto: InviteTeamDto) {
    await this.ensureCaptainOrOwner(teamId, inviterId);

    const inviteeProfile = await this.prisma.profile.findUnique({
      where: { nickname: dto.nickname },
      include: { user: true },
    });

    if (!inviteeProfile) {
      throw new NotFoundException('Игрок с таким никнеймом не найден');
    }

    if (inviteeProfile.userId === inviterId) {
      throw new ConflictException('Нельзя пригласить самого себя');
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: inviteeProfile.userId } },
    });
    if (existingMember) {
      throw new ConflictException('Игрок уже в команде');
    }

    const pendingInvite = await this.prisma.teamInvite.findFirst({
      where: {
        teamId,
        inviteeId: inviteeProfile.userId,
        status: TeamInviteStatus.PENDING,
      },
    });
    if (pendingInvite) {
      throw new ConflictException('Приглашение уже отправлено');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = await this.prisma.teamInvite.create({
      data: {
        teamId,
        inviterId,
        inviteeId: inviteeProfile.userId,
        expiresAt,
      },
      include: {
        team: { select: { id: true, name: true, tag: true } },
        inviter: { include: { profile: true } },
      },
    });

    return {
      id: invite.id,
      token: invite.token,
      team: invite.team,
      inviterNickname: invite.inviter.profile?.nickname,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async acceptInvite(teamId: string, userId: string, dto: AcceptInviteDto) {
    const invite = await this.prisma.teamInvite.findFirst({
      where: {
        id: dto.inviteId,
        teamId,
        inviteeId: userId,
        status: TeamInviteStatus.PENDING,
      },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.expiresAt < new Date()) {
      await this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: TeamInviteStatus.EXPIRED },
      });
      throw new ConflictException('Срок приглашения истёк');
    }

    await this.prisma.$transaction([
      this.prisma.teamMember.create({
        data: { teamId, userId, role: TeamRole.MEMBER },
      }),
      this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: TeamInviteStatus.ACCEPTED },
      }),
      this.prisma.teamInvite.updateMany({
        where: {
          teamId,
          inviteeId: userId,
          status: TeamInviteStatus.PENDING,
          id: { not: invite.id },
        },
        data: { status: TeamInviteStatus.DECLINED },
      }),
    ]);

    return this.findById(teamId);
  }

  async declineInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.teamInvite.findFirst({
      where: { id: inviteId, inviteeId: userId, status: TeamInviteStatus.PENDING },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    await this.prisma.teamInvite.update({
      where: { id: inviteId },
      data: { status: TeamInviteStatus.DECLINED },
    });

    return { success: true };
  }

  async listMyInvites(userId: string) {
    const invites = await this.prisma.teamInvite.findMany({
      where: {
        inviteeId: userId,
        status: TeamInviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        inviter: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((inv) => ({
      id: inv.id,
      teamId: inv.teamId,
      team: inv.team,
      inviterNickname: inv.inviter.profile?.nickname,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  async removeMember(teamId: string, actorId: string, memberUserId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberUserId } },
    });

    if (!member) {
      throw new NotFoundException('Участник не найден');
    }

    if (member.role === TeamRole.OWNER) {
      throw new ForbiddenException('Нельзя удалить владельца команды');
    }

    if (memberUserId === actorId) {
      await this.contractsService.assertPlayerCanLeaveTeam(actorId, teamId);
      await this.prisma.teamMember.delete({ where: { id: member.id } });
      return { success: true };
    }

    await this.ensureCaptainOrOwner(teamId, actorId);
    await this.prisma.teamMember.delete({ where: { id: member.id } });
    return this.findById(teamId);
  }

  private async ensureCaptainOrOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership || !['OWNER', 'CAPTAIN'].includes(membership.role)) {
      throw new ForbiddenException('Только капитан или владелец может выполнить это действие');
    }
  }

  private teamInclude() {
    return {
      owner: { include: { profile: true } },
      kitTemplate: true,
      members: {
        include: {
          user: { include: { profile: true, stats: true } },
        },
        orderBy: { joinedAt: 'asc' as const },
      },
    };
  }

  private formatClubListItem(team: {
    id: string;
    name: string;
    tag: string;
    avatar: string | null;
    country: string | null;
    countryCode: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string | null;
    kitTemplateId: string | null;
    kitTemplate?: { id: string; name: string } | null;
    _count: { members: number };
    members: { user: { stats: { rating: number } | null } }[];
  }) {
    const totalRating = team.members.reduce((sum, m) => sum + (m.user.stats?.rating ?? 1200), 0);
    const avgRating = team.members.length > 0 ? Math.round(totalRating / team.members.length) : 1200;

    return {
      id: team.id,
      name: team.name,
      tag: team.tag,
      avatar: team.avatar,
      country: team.country,
      countryCode: team.countryCode,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      accentColor: team.accentColor,
      kitTemplateId: team.kitTemplateId,
      kitTemplateName: team.kitTemplate?.name ?? null,
      memberCount: team._count.members,
      avgRating,
    };
  }

  private formatTeam(team: {
    id: string;
    name: string;
    tag: string;
    avatar: string | null;
    country: string | null;
    countryCode: string | null;
    description: string | null;
    vkGroupUrl?: string | null;
    twitchUrl?: string | null;
    youtubeUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string | null;
    kitTemplateId?: string | null;
    coverBannerUrl?: string | null;
    kitTemplate?: { id: string; name: string } | null;
    createdAt: Date;
    owner: { id: string; profile: { nickname: string; avatar: string | null } | null };
    members: {
      role: TeamRole;
      joinedAt: Date;
      user: {
        id: string;
        profile: { nickname: string; avatar: string | null; countryCode: string | null } | null;
        stats: { rating: number; wins: number; losses: number } | null;
      };
    }[];
  }) {
    const totalRating = team.members.reduce((sum, m) => sum + (m.user.stats?.rating ?? 1200), 0);
    const avgRating = team.members.length > 0 ? Math.round(totalRating / team.members.length) : 1200;

    const totalWins = team.members.reduce((sum, m) => sum + (m.user.stats?.wins ?? 0), 0);
    const totalLosses = team.members.reduce((sum, m) => sum + (m.user.stats?.losses ?? 0), 0);

    return {
      id: team.id,
      name: team.name,
      tag: team.tag,
      avatar: team.avatar,
      country: team.country,
      countryCode: team.countryCode,
      description: team.description,
      vkGroupUrl: team.vkGroupUrl ?? null,
      twitchUrl: team.twitchUrl ?? null,
      youtubeUrl: team.youtubeUrl ?? null,
      primaryColor: team.primaryColor ?? '#1a1a2e',
      secondaryColor: team.secondaryColor ?? '#C6FF3D',
      accentColor: team.accentColor ?? null,
      kitTemplateId: team.kitTemplateId ?? null,
      kitTemplateName: team.kitTemplate?.name ?? null,
      coverBannerUrl: team.coverBannerUrl ?? null,
      createdAt: team.createdAt.toISOString().split('T')[0],
      avgRating,
      totalWins,
      totalLosses,
      memberCount: team.members.length,
      owner: {
        id: team.owner.id,
        nickname: team.owner.profile?.nickname,
        avatar: team.owner.profile?.avatar,
      },
      members: team.members.map((m) => ({
        id: m.user.id,
        nickname: m.user.profile?.nickname,
        avatar: m.user.profile?.avatar,
        countryCode: m.user.profile?.countryCode,
        rating: m.user.stats?.rating ?? 1200,
        wins: m.user.stats?.wins ?? 0,
        losses: m.user.stats?.losses ?? 0,
        role: m.role,
        joinedAt: m.joinedAt.toISOString().split('T')[0],
      })),
    };
  }
}
