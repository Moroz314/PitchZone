'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import {
  getEaSyncImports,
  getEaSyncStatus,
  triggerEaSyncPoll,
  triggerEaSyncPollTeam,
  type EaSyncImportItem,
  type EaSyncStatus,
} from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  IMPORTED: 'Импортирован',
  NEEDS_REVIEW: 'На проверке',
  DISCARDED: 'Отклонён',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  IMPORTED: 'default',
  NEEDS_REVIEW: 'secondary',
  DISCARDED: 'outline',
};

function formatDt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU');
}

export function EaSyncPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<EaSyncStatus | null>(null);
  const [imports, setImports] = useState<EaSyncImportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!session?.accessToken) return;
    const [s, imp] = await Promise.all([
      getEaSyncStatus(session.accessToken),
      getEaSyncImports(session.accessToken),
    ]);
    setStatus(s);
    setImports(imp);
  }, [session?.accessToken]);

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, [reload]);

  async function handlePollAll() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await triggerEaSyncPoll(session.accessToken);
      setMessage(
        `Опрос завершён: ${result.imported} импортировано, ${result.needsReview} на проверке, ${result.newMatches} новых EA-матчей`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка опроса');
    } finally {
      setLoading(false);
    }
  }

  async function handlePollTeam(teamId: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const result = await triggerEaSyncPollTeam(session.accessToken, teamId);
      setMessage(
        `[${teamId}] импортировано: ${result.imported}, на проверке: ${result.needsReview}`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/moderation/stats"
            className="text-muted-foreground hover:text-accent text-sm"
          >
            ← StatTracker
          </Link>
          <h1 className="font-display mt-4 text-3xl font-bold">EA Sync</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Мониторинг автоподтягивания статистики из proclubs.ea.com. Доступ: StatTracker и
            администраторы.
          </p>
        </div>
        <Button onClick={handlePollAll} disabled={loading}>
          {loading ? 'Опрос EA…' : 'Опросить сейчас'}
        </Button>
      </div>

      {(error || message) && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-destructive/50 text-destructive' : 'border-accent/30 text-accent'
          }`}
        >
          {error || message}
        </div>
      )}

      {status && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Привязанных клубов</p>
              <p className="font-display text-2xl font-bold">{status.linkedClubsCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Последний опрос EA</p>
              <p className="text-sm font-medium">{formatDt(status.lastPolledAt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Импортировано</p>
              <p className="font-display text-accent text-2xl font-bold">
                {status.importCounts.imported}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">На проверке</p>
              <p className="font-display text-2xl font-bold">{status.importCounts.needsReview}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {status && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Привязки EA Club ID</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {status.links.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                Нет привязок. Капитаны указывают EA Club ID на странице клуба (/teams/…).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клуб PitchZone</TableHead>
                    <TableHead>EA Club ID</TableHead>
                    <TableHead>Платформа</TableHead>
                    <TableHead>Последний опрос</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.links.map((link) => (
                    <TableRow key={link.teamId}>
                      <TableCell>
                        <Link
                          href={`/teams/${link.teamId}`}
                          className="text-accent hover:underline"
                        >
                          [{link.teamTag}] {link.teamName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono">{link.eaClubId}</TableCell>
                      <TableCell>{link.platform}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDt(link.lastPolledAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => handlePollTeam(link.teamId)}
                        >
                          Опросить
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Журнал импортов EA</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>EA Match ID</TableHead>
                <TableHead>Клуб</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>SeasonMatch</TableHead>
                <TableHead>Примечание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Импортов пока нет. Нажмите «Опросить сейчас» или дождитесь воркера.
                  </TableCell>
                </TableRow>
              ) : (
                imports.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{formatDt(item.importedAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{item.eaMatchId}</TableCell>
                    <TableCell>
                      [{item.teamTag}] {item.teamName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[item.importStatus] ?? 'outline'}>
                        {STATUS_LABELS[item.importStatus] ?? item.importStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.matchedSeasonMatch
                        ? `[${item.matchedSeasonMatch.homeTeam.tag}] vs [${item.matchedSeasonMatch.awayTeam.tag}]`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                      {item.reviewNote ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {status?.workerNote && (
        <p className="text-muted-foreground mt-6 text-sm">{status.workerNote}</p>
      )}
    </div>
  );
}
