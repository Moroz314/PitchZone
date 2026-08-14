'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { cn } from '@pitchzone/ui';

const ADMIN_LINKS = [
  { href: '/admin', label: 'Обзор', exact: true },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/tournaments', label: 'Турниры' },
  { href: '/admin/seasons', label: 'Сезоны' },
  { href: '/admin/finance', label: 'Финансы' },
  { href: '/admin/settings', label: 'Комиссии' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin');
      return;
    }
    if (status === 'authenticated' && session.user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [status, session, router]);

  if (status === 'loading' || !session?.user || session.user.role !== 'ADMIN') {
    return (
      <div className="text-muted-foreground mx-auto max-w-7xl px-4 py-16 text-center">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Админ-панель</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Управление пользователями, турнирами и финансами
          </p>
        </div>
        <Link href="/moderation/disputes" className="text-accent text-sm hover:underline">
          Модерация споров →
        </Link>
      </div>

      <nav className="border-border/50 mb-8 flex flex-wrap gap-2 border-b pb-3">
        {ADMIN_LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
