import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OfferContractDto } from '../transfers/dto/transfer.dto';

const MAX_CONTRACT_MONTHS = 3;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async expireStaleContracts() {
    await this.prisma.contract.updateMany({
      where: {
        status: ContractStatus.ACTIVE,
        endDate: { lt: new Date() },
      },
      data: { status: ContractStatus.EXPIRED },
    });
  }

  async listMyContracts(userId: string) {
    await this.expireStaleContracts();

    const contracts = await this.prisma.contract.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        offeredBy: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contracts.map((c) => this.formatContract(c));
  }

  async listTeamContracts(teamId: string, userId: string) {
    await this.ensureCaptainOrOwner(teamId, userId);
    await this.expireStaleContracts();

    const contracts = await this.prisma.contract.findMany({
      where: { teamId },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        player: { include: { profile: true } },
        offeredBy: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contracts.map((c) => this.formatContract(c));
  }

  async offer(teamId: string, offeredByUserId: string, dto: OfferContractDto) {
    await this.ensureCaptainOrOwner(teamId, offeredByUserId);

    const durationMonths = dto.durationMonths ?? 1;
    if (durationMonths < 1 || durationMonths > MAX_CONTRACT_MONTHS) {
      throw new BadRequestException(`Срок контракта — от 1 до ${MAX_CONTRACT_MONTHS} месяцев`);
    }

    const profile = await this.prisma.profile.findUnique({
      where: { nickname: dto.nickname },
    });
    if (!profile) {
      throw new NotFoundException('Игрок не найден');
    }

    if (profile.userId === offeredByUserId) {
      throw new BadRequestException('Нельзя предложить контракт самому себе');
    }

    const activeElsewhere = await this.prisma.contract.findFirst({
      where: {
        userId: profile.userId,
        status: { in: [ContractStatus.ACTIVE, ContractStatus.PENDING] },
        NOT: { teamId },
      },
    });
    if (activeElsewhere) {
      throw new ConflictException('У игрока уже есть активный или ожидающий контракт');
    }

    const pendingSame = await this.prisma.contract.findFirst({
      where: {
        teamId,
        userId: profile.userId,
        status: ContractStatus.PENDING,
      },
    });
    if (pendingSame) {
      throw new ConflictException('Контракт уже предложен этому игроку');
    }

    const contract = await this.prisma.contract.create({
      data: {
        teamId,
        userId: profile.userId,
        offeredByUserId,
        durationMonths,
        buyoutFee: dto.buyoutFee ?? 0,
      },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        player: { include: { profile: true } },
        offeredBy: { include: { profile: true } },
      },
    });

    return this.formatContract(contract);
  }

  async accept(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, userId, status: ContractStatus.PENDING },
    });
    if (!contract) {
      throw new NotFoundException('Предложение контракта не найдено');
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + contract.durationMonths);

    await this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: contract.teamId, userId } },
      });

      if (!existingMember) {
        await tx.teamMember.create({
          data: { teamId: contract.teamId, userId, role: TeamRole.MEMBER },
        });
      }

      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.ACTIVE,
          startDate,
          endDate,
        },
      });

      await tx.contract.updateMany({
        where: {
          userId,
          id: { not: contractId },
          status: ContractStatus.PENDING,
        },
        data: { status: ContractStatus.DECLINED },
      });
    });

    return this.getContractById(contractId);
  }

  async decline(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, userId, status: ContractStatus.PENDING },
    });
    if (!contract) {
      throw new NotFoundException('Предложение контракта не найдено');
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.DECLINED },
    });

    return { success: true };
  }

  async terminateByBuyout(contractId: string, userId: string) {
    await this.expireStaleContracts();

    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, userId, status: ContractStatus.ACTIVE },
    });
    if (!contract) {
      throw new NotFoundException('Активный контракт не найден');
    }

    if (contract.buyoutFee <= 0) {
      throw new BadRequestException('Отступные не предусмотрены — нужно согласие капитана');
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < contract.buyoutFee) {
      throw new BadRequestException('Недостаточно средств для выплаты отступных');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: contract.buyoutFee } },
      });

      await tx.teamMember.deleteMany({
        where: { teamId: contract.teamId, userId },
      });

      await tx.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.TERMINATED },
      });
    });

    return { success: true };
  }

  async assertPlayerCanLeaveTeam(userId: string, teamId: string) {
    await this.expireStaleContracts();

    const contract = await this.prisma.contract.findFirst({
      where: {
        userId,
        teamId,
        status: ContractStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
    });

    if (contract) {
      throw new ForbiddenException(
        contract.buyoutFee > 0
          ? `Действует контракт до ${contract.endDate?.toLocaleDateString('ru-RU')}. Можно уйти только выплатив отступные ${contract.buyoutFee} ₽`
          : `Действует контракт до ${contract.endDate?.toLocaleDateString('ru-RU')}. Нужно согласие капитана`,
      );
    }
  }

  async getActiveContract(userId: string) {
    await this.expireStaleContracts();
    const contract = await this.prisma.contract.findFirst({
      where: { userId, status: ContractStatus.ACTIVE },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
      },
    });
    return contract ? this.formatContract(contract) : null;
  }

  private async getContractById(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        player: { include: { profile: true } },
        offeredBy: { include: { profile: true } },
      },
    });
    if (!contract) throw new NotFoundException('Контракт не найден');
    return this.formatContract(contract);
  }

  private async ensureCaptainOrOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership || !['OWNER', 'CAPTAIN'].includes(membership.role)) {
      throw new ForbiddenException('Только капитан или владелец клуба');
    }
  }

  private formatContract(contract: {
    id: string;
    teamId: string;
    userId: string;
    durationMonths: number;
    buyoutFee: number;
    status: ContractStatus;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    team: { id: string; name: string; tag: string; avatar: string | null };
    player?: { profile: { nickname: string } | null } | null;
    offeredBy?: { profile: { nickname: string } | null } | null;
  }) {
    return {
      id: contract.id,
      teamId: contract.teamId,
      userId: contract.userId,
      durationMonths: contract.durationMonths,
      buyoutFee: contract.buyoutFee,
      status: contract.status,
      startDate: contract.startDate?.toISOString() ?? null,
      endDate: contract.endDate?.toISOString() ?? null,
      createdAt: contract.createdAt.toISOString(),
      club: contract.team,
      playerNickname: contract.player?.profile?.nickname ?? null,
      offeredByNickname: contract.offeredBy?.profile?.nickname ?? null,
    };
  }
}
