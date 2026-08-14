'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@pitchzone/ui';

import { AdminShell } from '@/components/admin/admin-shell';
import { getAdminOverview, type AdminOverview } from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

export function AdminDashboardPage() {
  const { data: session } = useSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.accessToken) return;
    getAdminOverview(session.accessToken)
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, [session?.accessToken]);

  return (
    <AdminShell>
      {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

      {!overview ? (
        <p className="text-muted-foreground">Загрузка метрик…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Пользователи" value={String(overview.usersCount)} />
          <MetricCard
            title="На модерации"
            value={String(overview.tournamentsPendingModeration)}
            href="/admin/tournaments?status=PENDING_MODERATION"
            highlight={overview.tournamentsPendingModeration > 0}
          />
          <MetricCard title="Live турниры" value={String(overview.tournamentsLive)} />
          <MetricCard
            title="Открытые споры"
            value={String(overview.openDisputes)}
            href="/moderation/disputes"
          />
          <MetricCard
            title="В эскроу"
            value={formatCurrency(overview.escrow.totalHeld)}
            subtitle={`${overview.escrow.accounts} счетов`}
            href="/admin/finance"
          />
          <MetricCard
            title="Комиссия платформы"
            value={formatCurrency(overview.platformCommission.total)}
            subtitle={`${overview.platformCommission.transactions} транзакций`}
          />
          <MetricCard
            title="Выводы в обработке"
            value={String(overview.withdrawals.pending)}
            href="/admin/finance"
          />
          <MetricCard
            title="Выведено всего"
            value={formatCurrency(overview.withdrawals.completedTotal)}
          />
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Комиссия по умолчанию
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-bold">
                {overview.settings.defaultPlatformCommissionPercent}%
              </p>
              <Link
                href="/admin/settings"
                className="text-accent mt-2 inline-block text-xs hover:underline"
              >
                Изменить настройки
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  href,
  highlight,
}: {
  title: string;
  value: string;
  subtitle?: string;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <Card className={highlight ? 'border-amber-500/50' : 'glass'}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        {highlight && <Badge variant="warning">!</Badge>}
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
