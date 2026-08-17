import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

export interface CreateNotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(userId: string, input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });

    const unreadCount = await this.getUnreadCount(userId);
    this.gateway.emitNotification(userId, { notification, unreadCount });

    return notification;
  }

  async findByUser(userId: string, options?: { unreadOnly?: boolean; take?: number }) {
    return this.prisma.notification.findMany({
      where: { userId, ...(options?.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: options?.take ?? 50,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });

    const unreadCount = await this.getUnreadCount(userId);
    this.gateway.emitNotification(userId, { notification, unreadCount });

    return notification;
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    const unreadCount = await this.getUnreadCount(userId);
    this.gateway.emitNotification(userId, { unreadCount });
  }
}
