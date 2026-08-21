import { Injectable } from '@nestjs/common';

import { EscrowStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureForTournament(tournamentId: string, currency = 'RUB') {
    return this.prisma.escrowAccount.upsert({
      where: { tournamentId },
      create: { tournamentId, currency, status: EscrowStatus.HOLDING },
      update: {},
    });
  }

  async addHold(tournamentId: string, amount: number) {
    await this.ensureForTournament(tournamentId);
    return this.prisma.escrowAccount.update({
      where: { tournamentId },
      data: { totalHeld: { increment: amount } },
    });
  }

  async markRefunded(tournamentId: string) {
    return this.prisma.escrowAccount.update({
      where: { tournamentId },
      data: { status: EscrowStatus.REFUNDED, totalHeld: 0 },
    });
  }

  async markDistributed(tournamentId: string) {
    return this.prisma.escrowAccount.update({
      where: { tournamentId },
      data: { status: EscrowStatus.DISTRIBUTED, totalHeld: 0 },
    });
  }

  async getByTournament(tournamentId: string) {
    return this.prisma.escrowAccount.findUnique({ where: { tournamentId } });
  }
}
