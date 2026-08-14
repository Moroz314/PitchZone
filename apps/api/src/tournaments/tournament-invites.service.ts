import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TournamentInviteStatus,
  TournamentStatus,
  TournamentVisibility,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentInviteDto } from './dto/tournament-invite.dto';

@Injectable()
export class TournamentInvitesService {
  constructor(private readonly prisma: PrismaService) {}

  generateInviteToken() {
    return randomBytes(16).toString('hex');
  }

  async listInvites(tournamentId: string, organizerId: string) {
    await this.ensurePrivateOrganizer(tournamentId, organizerId);

    const invites = await this.prisma.tournamentInvite.findMany({
      where: { tournamentId },
      include: {
        invitedUser: { include: { profile: true } },
        invitedTeam: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => this.formatInvite(invite));
  }

  async createInvite(tournamentId: string, organizerId: string, dto: CreateTournamentInviteDto) {
    const tournament = await this.ensurePrivateOrganizer(tournamentId, organizerId);

    if (tournament.status === TournamentStatus.CANCELLED) {
      throw new BadRequestException('Турнир отменён');
    }

    let invitedUserId = dto.userId;
    let invitedTeamId = dto.teamId;

    if (dto.nickname) {
      const profile = await this.prisma.profile.findUnique({
        where: { nickname: dto.nickname },
      });
      if (!profile) throw new NotFoundException('Игрок с таким ником не найден');
      invitedUserId = profile.userId;
    }

    if (dto.teamTag) {
      const team = await this.prisma.team.findUnique({
        where: { tag: dto.teamTag.toUpperCase() },
      });
      if (!team) throw new NotFoundException('Команда с таким тегом не найдена');
      invitedTeamId = team.id;
    }

    if (!invitedUserId && !invitedTeamId) {
      throw new BadRequestException('Укажите nickname, userId, teamId или teamTag');
    }

    if (invitedUserId && invitedTeamId) {
      throw new BadRequestException('Укажите либо игрока, либо команду');
    }

    if (tournament.teamSize > 1 && !invitedTeamId) {
      throw new BadRequestException('Для командного приватного турнира пригласите команду');
    }

    if (tournament.teamSize === 1 && !invitedUserId) {
      throw new BadRequestException('Для соло-турнира пригласите игрока по нику');
    }

    try {
      const invite = await this.prisma.tournamentInvite.create({
        data: {
          tournamentId,
          invitedUserId,
          invitedTeamId,
          invitedByUserId: organizerId,
        },
        include: {
          invitedUser: { include: { profile: true } },
          invitedTeam: true,
        },
      });

      return this.formatInvite(invite);
    } catch {
      throw new ConflictException('Этот участник уже приглашён');
    }
  }

  async deleteInvite(tournamentId: string, inviteId: string, organizerId: string) {
    await this.ensurePrivateOrganizer(tournamentId, organizerId);

    const invite = await this.prisma.tournamentInvite.findFirst({
      where: { id: inviteId, tournamentId },
    });
    if (!invite) throw new NotFoundException('Приглашение не найдено');

    await this.prisma.tournamentInvite.delete({ where: { id: inviteId } });
    return { success: true };
  }

  async markInviteAccepted(tournamentId: string, userId: string, teamId?: string) {
    const invite = await this.prisma.tournamentInvite.findFirst({
      where: {
        tournamentId,
        status: { in: [TournamentInviteStatus.PENDING, TournamentInviteStatus.ACCEPTED] },
        ...(teamId ? { invitedTeamId: teamId } : { invitedUserId: userId }),
      },
    });

    if (!invite) return;

    if (invite.status === TournamentInviteStatus.PENDING) {
      await this.prisma.tournamentInvite.update({
        where: { id: invite.id },
        data: { status: TournamentInviteStatus.ACCEPTED },
      });
    }
  }

  async assertCanRegisterPrivate(params: {
    tournament: {
      id: string;
      visibility: TournamentVisibility;
      inviteToken: string | null;
      organizerId: string;
      teamSize: number;
    };
    userId: string;
    teamId?: string;
    inviteToken?: string;
  }) {
    const { tournament, userId, teamId, inviteToken } = params;

    if (tournament.visibility !== TournamentVisibility.PRIVATE) return;

    if (userId === tournament.organizerId) {
      throw new ForbiddenException('Организатор не может регистрироваться на свой турнир');
    }

    if (inviteToken && tournament.inviteToken && inviteToken === tournament.inviteToken) {
      return;
    }

    if (tournament.teamSize > 1) {
      if (!teamId) {
        throw new BadRequestException('Для командного турнира укажите teamId');
      }

      const teamInvite = await this.prisma.tournamentInvite.findFirst({
        where: {
          tournamentId: tournament.id,
          invitedTeamId: teamId,
          status: { in: [TournamentInviteStatus.PENDING, TournamentInviteStatus.ACCEPTED] },
        },
      });

      if (!teamInvite) {
        throw new ForbiddenException('Команда не приглашена на этот приватный турнир');
      }

      return;
    }

    const userInvite = await this.prisma.tournamentInvite.findFirst({
      where: {
        tournamentId: tournament.id,
        invitedUserId: userId,
        status: { in: [TournamentInviteStatus.PENDING, TournamentInviteStatus.ACCEPTED] },
      },
    });

    if (!userInvite) {
      throw new ForbiddenException('Нужно приглашение или ссылка с invite-токеном');
    }
  }

  async resolvePrivateAccess(params: {
    tournament: {
      id: string;
      visibility: TournamentVisibility;
      inviteToken: string | null;
      organizerId: string;
      teamSize: number;
    };
    userId?: string;
    inviteToken?: string;
    teamIds?: string[];
  }) {
    const { tournament, userId, inviteToken, teamIds = [] } = params;

    if (tournament.visibility !== TournamentVisibility.PRIVATE) {
      return {
        canRegister: true,
        hasValidInviteLink: false,
        reason: null as string | null,
        isOrganizer: false,
      };
    }

    const hasValidInviteLink = !!(
      inviteToken &&
      tournament.inviteToken &&
      inviteToken === tournament.inviteToken
    );

    if (!userId) {
      return {
        canRegister: false,
        hasValidInviteLink,
        reason: 'Войдите, чтобы зарегистрироваться по приглашению',
        isOrganizer: false,
      };
    }

    if (userId === tournament.organizerId) {
      return {
        canRegister: false,
        hasValidInviteLink,
        reason: null,
        isOrganizer: true,
      };
    }

    if (hasValidInviteLink) {
      return {
        canRegister: true,
        hasValidInviteLink,
        reason: null,
        isOrganizer: false,
      };
    }

    if (tournament.teamSize > 1) {
      const teamInvite = teamIds.length
        ? await this.prisma.tournamentInvite.findFirst({
            where: {
              tournamentId: tournament.id,
              invitedTeamId: { in: teamIds },
              status: { in: [TournamentInviteStatus.PENDING, TournamentInviteStatus.ACCEPTED] },
            },
          })
        : null;

      return {
        canRegister: !!teamInvite,
        hasValidInviteLink,
        reason: teamInvite ? null : 'Пригласите команду или откройте ссылку с invite-токеном',
        isOrganizer: false,
      };
    }

    const userInvite = await this.prisma.tournamentInvite.findFirst({
      where: {
        tournamentId: tournament.id,
        invitedUserId: userId,
        status: { in: [TournamentInviteStatus.PENDING, TournamentInviteStatus.ACCEPTED] },
      },
    });

    return {
      canRegister: !!userInvite,
      hasValidInviteLink,
      reason: userInvite ? null : 'Нужно персональное приглашение от организатора',
      isOrganizer: false,
    };
  }

  private async ensurePrivateOrganizer(tournamentId: string, organizerId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    if (tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Только организатор может управлять приглашениями');
    }

    if (tournament.visibility !== TournamentVisibility.PRIVATE) {
      throw new BadRequestException('Приглашения доступны только для приватных турниров');
    }

    return tournament;
  }

  private formatInvite(invite: {
    id: string;
    status: TournamentInviteStatus;
    createdAt: Date;
    invitedUser: { id: string; profile: { nickname: string } | null } | null;
    invitedTeam: { id: string; name: string; tag: string } | null;
  }) {
    return {
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
    };
  }
}
