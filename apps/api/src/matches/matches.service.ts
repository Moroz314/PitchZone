import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DisputeStatus, MatchStatus, TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BracketService } from '../tournaments/bracket.service';
import { TournamentsGateway } from '../tournaments/tournaments.gateway';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly bracketService: BracketService,
    private readonly tournamentsService: TournamentsService,
    private readonly gateway: TournamentsGateway,
  ) {}

  async findById(matchId: string) {
    await this.bracketService.processConfirmationTimeouts();

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        submissions: { include: { user: { include: { profile: true } } } },
        dispute: true,
      },
    });

    if (!match) throw new NotFoundException('Матч не найден');

    return this.formatMatchDetail(match, null);
  }

  async startMatch(matchId: string, userId: string) {
    const match = await this.loadMatchWithParticipants(matchId);
    await this.assertCanActOnMatch(match, userId);

    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Матч нельзя начать в текущем статусе');
    }

    if (match.status === MatchStatus.SCHEDULED) {
      const now = new Date();
      const isOrganizer = match.tournament.organizerId === userId;
      if (match.scheduledAt && match.scheduledAt > now && !isOrganizer) {
        throw new BadRequestException('Матч ещё не начался по расписанию');
      }
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.IN_PROGRESS,
        isActive: true,
      },
    });

    await this.prisma.match.updateMany({
      where: { tournamentId: match.tournamentId, id: { not: matchId } },
      data: { isActive: false },
    });

    return this.emitMatchUpdate(matchId);
  }

  async reportScore(
    matchId: string,
    userId: string,
    score1: number,
    score2: number,
    file: Express.Multer.File,
  ) {
    if (score1 === score2) {
      throw new BadRequestException('Ничья не допускается — укажите победителя');
    }

    const match = await this.loadMatchWithParticipants(matchId);
    const side = await this.resolveSideForUser(
      match.participant1Id,
      match.participant2Id,
      userId,
    );
    if (!side) {
      throw new ForbiddenException('Вы не участник этого матча');
    }

    if (
      match.status !== MatchStatus.IN_PROGRESS &&
      match.status !== MatchStatus.AWAITING_CONFIRMATION
    ) {
      throw new BadRequestException('Сейчас нельзя отправить результат');
    }

    const participantId = side === 1 ? match.participant1Id! : match.participant2Id!;
    const proofUrl = await this.storage.uploadMatchProof(
      file,
      match.tournamentId,
      matchId,
    );

    await this.prisma.matchSubmission.upsert({
      where: { matchId_participantId: { matchId, participantId } },
      create: {
        matchId,
        participantId,
        userId,
        score1,
        score2,
        proofUrl,
      },
      update: {
        userId,
        score1,
        score2,
        proofUrl,
        submittedAt: new Date(),
      },
    });

    return this.reconcileMatch(matchId, userId);
  }

  private async reconcileMatch(matchId: string, actorUserId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        submissions: true,
      },
    });

    if (!match) throw new NotFoundException('Матч не найден');

    const p1Id = match.participant1Id;
    const p2Id = match.participant2Id;
    if (!p1Id || !p2Id) {
      throw new BadRequestException('Участники матча не определены');
    }

    const sub1 = match.submissions.find((s) => s.participantId === p1Id);
    const sub2 = match.submissions.find((s) => s.participantId === p2Id);

    if (!sub1 || !sub2) {
      const timeoutHours = match.tournament.matchResultTimeoutHours;
      const deadline = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);

      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.AWAITING_CONFIRMATION,
          confirmationDeadline: deadline,
        },
      });

      return this.emitMatchUpdate(matchId);
    }

    const scoresMatch = sub1.score1 === sub2.score1 && sub1.score2 === sub2.score2;

    if (scoresMatch) {
      await this.bracketService.finalizeMatch(matchId, sub1.score1, sub1.score2);
      return this.emitMatchUpdate(matchId);
    }

    await this.bracketService.openDispute(matchId, actorUserId, 'Расхождение в отчётах о счёте');
    return this.emitMatchUpdate(matchId);
  }

  private async loadMatchWithParticipants(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        submissions: true,
      },
    });

    if (!match) throw new NotFoundException('Матч не найден');
    return match;
  }

  private async resolveSideForUser(
    participant1Id: string | null,
    participant2Id: string | null,
    userId: string,
  ): Promise<1 | 2 | null> {
    const ids = [participant1Id, participant2Id].filter(Boolean) as string[];
    if (ids.length === 0) return null;

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { id: { in: ids } },
      include: {
        team: { include: { members: true } },
      },
    });

    for (const p of participants) {
      const isUserParticipant = p.userId === userId;
      const isTeamRep =
        p.team &&
        (p.team.ownerId === userId ||
          p.team.members.some(
            (m) =>
              m.userId === userId && (m.role === TeamRole.CAPTAIN || m.role === TeamRole.OWNER),
          ));

      if (isUserParticipant || isTeamRep) {
        if (p.id === participant1Id) return 1;
        if (p.id === participant2Id) return 2;
      }
    }

    return null;
  }

  private async assertCanActOnMatch(
    match: {
      participant1Id: string | null;
      participant2Id: string | null;
      tournament: { organizerId: string };
    },
    userId: string,
  ) {
    if (match.tournament.organizerId === userId) return;

    const side = await this.resolveSideForUser(
      match.participant1Id,
      match.participant2Id,
      userId,
    );
    if (!side) {
      throw new ForbiddenException('Вы не участник этого матча');
    }
  }

  private async emitMatchUpdate(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Матч не найден');

    const tournament = await this.tournamentsService.findBySlug(match.tournament.slug);
    const formatted = this.tournamentsService.formatMatch(match);

    this.gateway.emitMatchUpdate(match.tournament.slug, { match: formatted, tournament });

    const detail = await this.findById(matchId);
    return { match: detail, tournament };
  }

  private formatMatchDetail(
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
      isActive: boolean;
      scheduledAt: Date | null;
      confirmationDeadline: Date | null;
      completedAt: Date | null;
      tournament: { proofRequirement: string; matchResultTimeoutHours: number };
      submissions: {
        participantId: string;
        score1: number;
        score2: number;
        proofUrl: string;
        submittedAt: Date;
        user: { profile: { nickname: string } | null };
      }[];
      dispute: {
        id: string;
        status: DisputeStatus;
        reasonText: string | null;
        createdAt: Date;
      } | null;
    },
    myParticipantId: string | null,
  ) {
    const base = this.tournamentsService.formatMatch(match);

    return {
      ...base,
      participant1Id: match.participant1Id,
      participant2Id: match.participant2Id,
      confirmationDeadline: match.confirmationDeadline?.toISOString(),
      completedAt: match.completedAt?.toISOString(),
      proofRequirement: match.tournament.proofRequirement,
      matchResultTimeoutHours: match.tournament.matchResultTimeoutHours,
      submissions: match.submissions.map((s) => ({
        participantId: s.participantId,
        score1: s.score1,
        score2: s.score2,
        proofUrl: s.proofUrl,
        submittedAt: s.submittedAt.toISOString(),
        submittedBy: s.user.profile?.nickname ?? 'Unknown',
      })),
      dispute: match.dispute
        ? {
            id: match.dispute.id,
            status: match.dispute.status,
            reasonText: match.dispute.reasonText,
            createdAt: match.dispute.createdAt.toISOString(),
          }
        : null,
      myParticipantId,
    };
  }
}
