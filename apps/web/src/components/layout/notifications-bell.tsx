'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@pitchzone/ui';

import { useNotifications } from '@/hooks/use-notifications';
import { markAllNotificationsRead, markNotificationRead, type NotificationItem } from '@/lib/api';

function NotificationRow({
  item,
  token,
  onRead,
}: {
  item: NotificationItem;
  token: string;
  onRead: () => void;
}) {
  const content = (
    <div
      className={`flex flex-col gap-0.5 px-4 py-3 text-sm ${
        item.isRead ? 'text-muted-foreground' : 'text-foreground'
      }`}
    >
      <p className="font-medium">{item.title}</p>
      <p className="text-xs">{item.message}</p>
      <p className="text-muted-foreground text-xs">
        {new Date(item.createdAt).toLocaleString('ru-RU')}
      </p>
    </div>
  );

  return (
    <div className="hover:bg-muted/50 group flex items-stretch">
      {item.link ? (
        <Link
          href={item.link}
          className="flex-1"
          onClick={() => !item.isRead && markNotificationRead(token, item.id).then(onRead)}
        >
          {content}
        </Link>
      ) : (
        <button
          className="flex-1 text-left"
          onClick={() => !item.isRead && markNotificationRead(token, item.id).then(onRead)}
        >
          {content}
        </button>
      )}
    </div>
  );
}

export function NotificationsBell() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userId = session?.user?.id;
  const { unreadCount, notifications, open, setOpen, refresh } = useNotifications(token, userId);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  if (!session?.user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="bg-destructive absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="border-border bg-background absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl">
          <div className="border-border flex items-center justify-between border-b px-4 py-2">
            <p className="text-sm font-medium">Уведомления</p>
            {unreadCount > 0 && token && (
              <button
                className="text-accent text-xs hover:underline"
                onClick={() => markAllNotificationsRead(token).then(refresh)}
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">Нет уведомлений</p>
            ) : (
              notifications.map((item) => (
                <NotificationRow key={item.id} item={item} token={token!} onRead={refresh} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
