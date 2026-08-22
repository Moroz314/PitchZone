'use client';

import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getNotifications, getUnreadNotificationCount, type NotificationItem } from '@/lib/api';

const WS_BASE =
  (typeof window !== 'undefined' ? (window as any).__ENV?.WS_URL : process.env.NEXT_PUBLIC_WS_URL) ??
  ((typeof window !== 'undefined' ? (window as any).__ENV?.API_URL : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:4000/api').replace('/api', '');

export function useNotifications(accessToken: string | undefined, userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const count = await getUnreadNotificationCount(accessToken);
    setUnreadCount(count);
    if (open) {
      const items = await getNotifications(accessToken);
      setNotifications(items);
    }
  }, [accessToken, open]);

  useEffect(() => {
    if (!accessToken || !userId) return;

    refresh();

    const interval = setInterval(() => refresh(), 30000);

    const socket: Socket = io(`${WS_BASE}/notifications`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join', userId);
    });

    socket.on('notification:new', () => {
      refresh();
    });

    return () => {
      socket.emit('leave', userId);
      socket.disconnect();
      clearInterval(interval);
    };
  }, [accessToken, userId, refresh]);

  return { unreadCount, notifications, open, setOpen, refresh };
}
