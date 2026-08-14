'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@pitchzone/ui';

import {
  getDispute,
  getDisputes,
  resolveDispute,
  reviewDispute,
  type DisputeDetail,
  type DisputeListItem,
  type DisputeStatus,
} from '@/lib/api';

const STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Открыт',
  UNDER_REVIEW: 'На рассмотрении',
  RESOLVED_A: 'Победа A',
  RESOLVED_B: 'Победа B',
  REJECTED: 'Переигровка',
};

const OPEN_STATUSES: DisputeStatus[] = ['OPEN', 'UNDER_REVIEW'];

function isModerator(role?: string) {
  return role === 'MODERATOR' || role === 'ADMIN';
}

export function ModerationDisputesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const loadList = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const items = await getDisputes(session.accessToken);
      setDisputes(
        filter === 'open' ? items.filter((d) => OPEN_STATUSES.includes(d.status)) : items,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filter]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!session?.accessToken) return;
      try {
        const data = await getDispute(session.accessToken, id);
        setDetail(data);
        setSelectedId(id);
        setScore1('');
        setScore2('');
        setResolutionNote('');
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Ошибка загрузки спора');
      }
    },
    [session?.accessToken],
  );

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || !isModerator(session.user.role)) {
      router.replace('/');
      return;
    }
    loadList();
  }, [session, status, router, loadList]);

  async function handleReview() {
    if (!session?.accessToken || !selectedId) return;
    setActionLoading(true);
    setMessage('');
    try {
      const updated = await reviewDispute(
        session.accessToken,
        selectedId,
        resolutionNote || undefined,
      );
      setDetail(updated);
      setMessage('Спор переведён на рассмотрение');
      await loadList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve(resolution: DisputeStatus) {
    if (!session?.accessToken || !selectedId) return;
    setActionLoading(true);
    setMessage('');
    try {
      await resolveDispute(session.accessToken, selectedId, {
        resolution,
        score1: resolution === 'REJECTED' ? undefined : Number(score1),
        score2: resolution === 'REJECTED' ? undefined : Number(score2),
        resolutionNote: resolutionNote || undefined,
      });
      setMessage('Решение сохранено');
      setDetail(null);
      setSelectedId(null);
      await loadList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionLoading(false);
    }
  }

  if (status === 'loading' || !session?.user || !isModerator(session.user.role)) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Модерация споров</h1>
        <p className="text-muted-foreground mt-2">
          Очередь споров по матчам — просмотр пруфов и вынесение решения
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          variant={filter === 'open' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('open')}
        >
          Активные
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Все
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Очередь ({disputes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-muted-foreground text-sm">Загрузка…</p>}
            {!loading && disputes.length === 0 && (
              <p className="text-muted-foreground text-sm">Нет споров</p>
            )}
            {disputes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => loadDetail(d.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedId === d.id
                    ? 'border-accent bg-accent/5'
                    : 'border-border/50 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={OPEN_STATUSES.includes(d.status) ? 'destructive' : 'secondary'}>
                    {STATUS_LABELS[d.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <p className="mt-2 font-medium">{d.tournament.title}</p>
                <p className="text-muted-foreground">
                  R{d.match.round}: {d.match.player1} vs {d.match.player2}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Детали спора</CardTitle>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <p className="text-muted-foreground text-sm">Выберите спор из списка</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-muted-foreground text-sm">Турнир</p>
                  <Link
                    href={`/tournaments/${detail.tournament.slug}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {detail.tournament.title}
                  </Link>
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">Матч</p>
                  <p>
                    {detail.match.player1} vs {detail.match.player2}
                  </p>
                  <p className="text-muted-foreground text-sm">{detail.reasonText}</p>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium">Пруфы и отчёты сторон</p>
                  {detail.submissions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Нет загруженных пруфов</p>
                  ) : (
                    detail.submissions.map((s) => (
                      <div key={s.participantId} className="border-border/50 rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-medium">Сторона {s.side}: </span>
                            {s.participantName}
                          </div>
                          <span className="text-accent font-mono">
                            {s.score1}:{s.score2}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Отправил {s.submittedBy} ·{' '}
                          {new Date(s.submittedAt).toLocaleString('ru-RU')}
                        </p>
                        <a
                          href={s.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent mt-2 inline-block text-sm hover:underline"
                        >
                          Открыть пруф
                        </a>
                      </div>
                    ))
                  )}
                </div>

                {OPEN_STATUSES.includes(detail.status) && (
                  <div className="border-border/50 space-y-4 border-t pt-4">
                    <textarea
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                      placeholder="Комментарий модератора (запрос доп. доказательств или решение)"
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      rows={3}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        placeholder="A"
                        value={score1}
                        onChange={(e) => setScore1(e.target.value)}
                      />
                      <span>:</span>
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        placeholder="B"
                        value={score2}
                        onChange={(e) => setScore2(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={handleReview}
                      >
                        На рассмотрение
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionLoading || !score1 || !score2}
                        onClick={() => handleResolve('RESOLVED_A')}
                      >
                        Победа A
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionLoading || !score1 || !score2}
                        onClick={() => handleResolve('RESOLVED_B')}
                      >
                        Победа B
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading}
                        onClick={() => handleResolve('REJECTED')}
                      >
                        Переигровка
                      </Button>
                    </div>
                  </div>
                )}

                {message && <p className="text-accent text-sm">{message}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
