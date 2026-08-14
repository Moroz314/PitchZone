'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminApproveTournament,
  adminCancelTournament,
  adminDeleteTournament,
  getAdminTournaments,
  type AdminTournament,
} from '@/lib/api';
import { formatCurrency, getStatusLabel, type TournamentStatus } from '@/lib/mock-data';

const STATUS_FILTER_LABELS: Record<string, string> = {
  PENDING_MODERATION: 'На модерации',
  REGISTRATION_OPEN: 'Регистрация открыта',
  REGISTRATION_CLOSED: 'Регистрация закрыта',
  LIVE: 'Live',
  FINISHED: 'Завершён',
  CANCELLED: 'Отменён',
  DRAFT: 'Черновик',
};

const STATUSES = [
  'PENDING_MODERATION',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'LIVE',
  'FINISHED',
  'CANCELLED',
  'DRAFT',
] as const;

export function AdminTournamentsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await getAdminTournaments(session.accessToken, {
        status: statusFilter || undefined,
        visibility: visibilityFilter || undefined,
      });
      setTournaments(data.items);
      setTotal(data.total);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, statusFilter, visibilityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(id: string, action: 'approve' | 'cancel' | 'delete') {
    if (!session?.accessToken) return;
    if (action === 'delete') {
      const confirmed = window.confirm(
        'Удалить турнир безвозвратно? Все связанные данные будут стёрты.',
      );
      if (!confirmed) return;
    }
    setActionId(id);
    setMessage('');
    try {
      if (action === 'approve') {
        await adminApproveTournament(session.accessToken, id);
      } else if (action === 'cancel') {
        await adminCancelTournament(session.accessToken, id);
      } else {
        await adminDeleteTournament(session.accessToken, id);
      }
      await load();
      setMessage(
        action === 'approve'
          ? 'Турнир одобрен'
          : action === 'cancel'
            ? 'Турнир отменён, средства возвращены'
            : 'Турнир удалён',
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionId(null);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_FILTER_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
        >
          <option value="">Публичные и приватные</option>
          <option value="PUBLIC">Публичные</option>
          <option value="PRIVATE">Приватные</option>
        </select>
      </div>

      {message && <p className="text-accent mb-4 text-sm">{message}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Турнир</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Организатор</TableHead>
                <TableHead>Фонд / комиссия</TableHead>
                <TableHead>Эскроу</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>Загрузка…</TableCell>
                </TableRow>
              ) : tournaments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>Турниры не найдены</TableCell>
                </TableRow>
              ) : (
                tournaments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/tournaments/${t.slug}`}
                        className="hover:text-accent font-medium"
                      >
                        {t.title}
                      </Link>
                      <div className="mt-1 flex gap-1">
                        <Badge variant="outline">{t.visibility}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {t.participants}/{t.maxParticipants}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusLabel(t.status as TournamentStatus)}</TableCell>
                    <TableCell className="text-sm">{t.organizer.nickname}</TableCell>
                    <TableCell className="text-sm">
                      <p>{formatCurrency(t.prizePool)}</p>
                      <p className="text-muted-foreground text-xs">
                        комиссия {t.platformCommissionPercent}%
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(t.escrowHeld)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.statusKey === 'PENDING_MODERATION' && (
                          <Button
                            size="sm"
                            disabled={actionId === t.id}
                            onClick={() => runAction(t.id, 'approve')}
                          >
                            Одобрить
                          </Button>
                        )}
                        {!['FINISHED', 'CANCELLED', 'LIVE'].includes(t.statusKey) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionId === t.id}
                            onClick={() => runAction(t.id, 'cancel')}
                          >
                            Отменить
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/50 text-destructive"
                          disabled={actionId === t.id}
                          onClick={() => runAction(t.id, 'delete')}
                        >
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-3 text-xs">Всего: {total}</p>
    </AdminShell>
  );
}
