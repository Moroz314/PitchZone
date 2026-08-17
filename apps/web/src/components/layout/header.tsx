'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage, Button } from '@pitchzone/ui';

import { getOnboardingProgress } from '@/lib/api';
import { NotificationsBell } from './notifications-bell';

const NAV_LINKS = [
  { href: '/', label: 'Турниры' },
  { href: '/clubs', label: 'Клубы' },
  { href: '/seasons', label: 'Сезоны' },
  { href: '/leaderboard', label: 'Рейтинг' },
  { href: '/transfers', label: 'Трансферы' },
];

export function Header() {
  const { data: session } = useSession();
  const [showOnboardingLink, setShowOnboardingLink] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) {
      setShowOnboardingLink(false);
      return;
    }

    getOnboardingProgress(session.accessToken)
      .then((p) => setShowOnboardingLink(!p.allComplete))
      .catch(() => setShowOnboardingLink(false));
  }, [session?.accessToken]);

  return (
    <header className="border-border/50 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold tracking-tight">
            Pitch<span className="text-accent">Zone</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <NotificationsBell />
              {showOnboardingLink && (
                <Button variant="default" size="sm" className="hidden sm:inline-flex" asChild>
                  <Link href="/start">С чего начать</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/wallet">Кошелёк</Link>
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/invites">Приглашения</Link>
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/contracts">Контракты</Link>
              </Button>
              {(session.user.role === 'MODERATOR' || session.user.role === 'ADMIN') && (
                <>
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                    <Link href="/moderation/stats">StatTracker</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                    <Link href="/moderation/ea-sync">EA Sync</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                    <Link href="/moderation/disputes">Модерация</Link>
                  </Button>
                </>
              )}
              {session.user.role === 'ADMIN' && (
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                  <Link href="/admin">Админ</Link>
                </Button>
              )}
              <Link
                href={`/players/${session.user.id}`}
                className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1 transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.avatar ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {session.user.nickname?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  {session.user.nickname}
                </span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
                Выйти
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Войти</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Регистрация</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
