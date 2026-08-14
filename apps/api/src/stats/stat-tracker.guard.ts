import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatTrackerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Требуется авторизация');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Пользователь не найден');

    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.MODERATOR && user.isStatTracker) return true;

    throw new ForbiddenException('Требуется роль StatTracker');
  }
}
