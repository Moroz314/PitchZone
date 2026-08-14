import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DisputeStatus, MatchStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BracketService } from '../tournaments/bracket.service';
import { TournamentsGateway } from '../tournaments/tournaments.gateway';
import { TournamentsService } from '../tournaments/tournaments.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bracketService: BracketService,
    private readonly tournamentsService: TournamentsService,
    private readonly gateway: TournamentsGateway,
  ) {}

  async findAll(status?: DisputeStatus) {
    const disputes = await this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      include: {
        match: {
          include: {
            tournament: { select: { id: true, slug: true, title: true } },
            submissions: {
              include: {
                participant: {
                  include: {
                    user: { include: { profile: true } },
                    team: true,
                  },
                },
                user: { include: { profile: true } },
              },
            },
          },
        },
        openedBy: { include: { profile: true } },
        resolvedBy: { include: { profile: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return disputes.map((d) => this.formatDisputeListItem(d));
  }

  async findById(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        match: {
          include: {
            tournament: true,
            submissions: {
              include: {
                participant: {
                  include: {
                    user: { include: { profile: true } },
                    team: true,
                  },
                },
                user: { include: { profile: true } },
              },
            },
          },
        },
        openedBy: { include: { profile: true } },
        resolvedBy: { include: { profile: true } },
      },
    });

    if (!dispute) throw new NotFoundException('Спор не найден');
    return this.formatDisputeDetail(dispute);
  }

  async markUnderReview(id: string, moderatorId: string, note?: string) {
    await this.ensureModerator(moderatorId);

    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Спор не найден');

    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new ConflictException('Спор уже закрыт');
    }

    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.UNDER_REVIEW,
        resolutionNote: note ?? dispute.resolutionNote,
      },
      include: {
        match: { include: { tournament: { select: { slug: true } } } },
      },
    });

    return this.findById(updated.id);
  }

  async resolve(id: string, moderatorId: string, dto: ResolveDisputeDto) {
    await this.ensureModerator(moderatorId);

    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { match: { include: { tournament: true } } },
    });

    if (!dispute) throw new NotFoundException('Спор не найден');

    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new ConflictException('Спор уже закрыт');
    }

    if (dispute.match.status !== MatchStatus.DISPUTED) {
      throw new ConflictException('Матч не в статусе спора');
    }

    const allowed: DisputeStatus[] = [
      DisputeStatus.RESOLVED_A,
      DisputeStatus.RESOLVED_B,
      DisputeStatus.REJECTED,
    ];
    if (!allowed.includes(dto.resolution)) {
      throw new BadRequestException('Недопустимое решение');
    }

    if (dto.resolution === DisputeStatus.REJECTED) {
      await this.replayMatch(dispute.matchId);
    } else {
      if (dto.score1 === undefined || dto.score2 === undefined) {
        throw new BadRequestException('Укажите итоговый счёт');
      }
      if (dto.score1 === dto.score2) {
        throw new BadRequestException('Ничья не допускается');
      }

      const p1Wins = dto.score1 > dto.score2;
      if (dto.resolution === DisputeStatus.RESOLVED_A && !p1Wins) {
        throw new BadRequestException('RESOLVED_A: победитель — участник A (score1 > score2)');
      }
      if (dto.resolution === DisputeStatus.RESOLVED_B && p1Wins) {
        throw new BadRequestException('RESOLVED_B: победитель — участник B (score2 > score1)');
      }

      await this.bracketService.finalizeMatch(dispute.matchId, dto.score1, dto.score2);
    }

    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: dto.resolution,
        resolvedById: moderatorId,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
      },
    });

    const tournament = await this.tournamentsService.findBySlug(dispute.match.tournament.slug);
    this.gateway.emitTournamentUpdate(tournament.slug, tournament);
    this.gateway.emitBracketUpdate(tournament.slug, {
      tournament,
      matches: tournament.matches,
    });

    return this.findById(id);
  }

  private async replayMatch(matchId: string) {
    await this.prisma.matchSubmission.deleteMany({ where: { matchId } });
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.SCHEDULED,
        score1: null,
        score2: null,
        winnerId: null,
        confirmationDeadline: null,
        completedAt: null,
        scheduledAt: new Date(),
        isActive: false,
      },
    });
  }

  private async ensureModerator(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN)) {
      throw new ForbiddenException('Только модератор может выполнить это действие');
    }
  }

  private formatDisputeListItem(dispute: {
    id: string;
    status: DisputeStatus;
    reasonText: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    match: {
      id: string;
      round: number;
      participant1Name: string | null;
      participant2Name: string | null;
      tournament: { id: string; slug: string; title: string };
    };
    openedBy: { profile: { nickname: string } | null };
  }) {
    return {
      id: dispute.id,
      status: dispute.status,
      reasonText: dispute.reasonText,
      createdAt: dispute.createdAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString(),
      openedBy: dispute.openedBy.profile?.nickname ?? 'Unknown',
      match: {
        id: dispute.match.id,
        round: dispute.match.round,
        player1: dispute.match.participant1Name,
        player2: dispute.match.participant2Name,
      },
      tournament: dispute.match.tournament,
    };
  }

  private formatDisputeDetail(dispute: {
    id: string;
    status: DisputeStatus;
    reasonText: string | null;
    resolutionNote: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    match: {
      id: string;
      round: number;
      position: number;
      participant1Id: string | null;
      participant2Id: string | null;
      participant1Name: string | null;
      participant2Name: string | null;
      score1: number | null;
      score2: number | null;
      status: MatchStatus;
      tournament: { id: string; slug: string; title: string; proofRequirement: string };
      submissions: {
        participantId: string;
        score1: number;
        score2: number;
        proofUrl: string;
        submittedAt: Date;
        participant: {
          user: { profile: { nickname: string } | null } | null;
          team: { name: string } | null;
        };
        user: { profile: { nickname: string } | null };
      }[];
    };
    openedBy: { profile: { nickname: string } | null };
    resolvedBy: { profile: { nickname: string } | null } | null;
  }) {
    return {
      ...this.formatDisputeListItem({
        ...dispute,
        match: {
          ...dispute.match,
          tournament: dispute.match.tournament,
        },
      }),
      resolutionNote: dispute.resolutionNote,
      resolvedBy: dispute.resolvedBy?.profile?.nickname ?? null,
      match: {
        ...this.tournamentsService.formatMatch({
          ...dispute.match,
          isActive: false,
        }),
        participant1Id: dispute.match.participant1Id,
        participant2Id: dispute.match.participant2Id,
        proofRequirement: dispute.match.tournament.proofRequirement,
      },
      submissions: dispute.match.submissions.map((s) => ({
        participantId: s.participantId,
        participantName:
          s.participant.user?.profile?.nickname ?? s.participant.team?.name ?? 'Unknown',
        side:
          s.participantId === dispute.match.participant1Id
            ? 'A'
            : s.participantId === dispute.match.participant2Id
              ? 'B'
              : '?',
        score1: s.score1,
        score2: s.score2,
        proofUrl: s.proofUrl,
        submittedAt: s.submittedAt.toISOString(),
        submittedBy: s.user.profile?.nickname ?? 'Unknown',
      })),
    };
  }
}
