'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import {
  completeSeasonMatch,
  createSeasonMatch,
  getSeasons,
  getStatTrackerMatches,
  recalculateSeasonRatings,
  submitMatchStats,
  type SeasonSummary,
  type StatTrackerMatch,
} from '@/lib/api';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'];

interface PlayerStatRow {
  userId: string;
  positionPlayed: string;
  passAccuracy: number;
  dribbles: number;
  tacklesWon: number;
  goals: number;
  assists: number;
  saves: number;
  interceptions: number;
  fouls: number;
  cleanSheet: boolean;
}

const emptyRow = (): PlayerStatRow => ({
  userId: '',
  positionPlayed: 'CM',
  passAccuracy: 75,
  dribbles: 0,
  tacklesWon: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  interceptions: 0,
  fouls: 0,
  cleanSheet: false,
});

export function StatTrackerPage() {
  const { data: session } = useSession();
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [matches, setMatches] = useState<StatTrackerMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [filterSeason, setFilterSeason] = useState('');
  const [rows, setRows] = useState<PlayerStatRow[]>([emptyRow(), emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newMatch, setNewMatch] = useState({
    seasonId: '',
    homeTeamId: '',
    awayTeamId: '',
    weekLabel: 'Тур 1',
    roundNumber: 1,
  });

  const [scoreForm, setScoreForm] = useState({ homeScore: 0, awayScore: 0 });
  const [recalcSeasonId, setRecalcSeasonId] = useState('');

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const [seasonList, matchList] = await Promise.all([
        getSeasons(),
        getStatTrackerMatches(session.accessToken, filterSeason || undefined),
      ]);
      setSeasons(seasonList);
      setMatches(matchList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterSeason]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError('');
    try {
      await createSeasonMatch(session.accessToken, {
        ...newMatch,
        roundNumber: Number(newMatch.roundNumber),
      });
      setMessage('Матч создан');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleCompleteMatch() {
    if (!session?.accessToken || !selectedMatch) return;
    await completeSeasonMatch(session.accessToken, selectedMatch, scoreForm);
    setMessage('Счёт сохранён');
    await load();
  }

  async function handleSubmitStats(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !selectedMatch) return;
    setError('');
    try {
      const players = rows.filter((r) => r.userId.trim());
      if (players.length === 0) {
        setError('Добавьте хотя бы одного игрока');
        return;
      }
      const result = await submitMatchStats(session.accessToken, selectedMatch, { players });
      setMessage(`Статистика сохранена для ${result.length} игроков`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleRecalc() {
    if (!session?.accessToken || !recalcSeasonId) return;
    const result = await recalculateSeasonRatings(session.accessToken, recalcSeasonId);
    setMessage(`Пересчёт: ${result.eligibleCount} из ${result.playersProcessed} игроков`);
  }

  function updateRow(index: number, field: keyof PlayerStatRow, value: string | number | boolean) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/moderation/disputes"
          className="text-muted-foreground hover:text-accent text-sm"
        >
          ← Модерация
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold">StatTracker — ввод статистики</h1>
        <p className="text-muted-foreground mt-2">
          Ручной ввод статистики официальных матчей сезона. XP рассчитывается автоматически на
          сервере.
        </p>
      </div>

      {message && <p className="text-accent mb-4 text-sm">{message}</p>}
      {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Создать матч сезона</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateMatch} className="space-y-3">
              <div className="space-y-2">
                <Label>Сезон</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  value={newMatch.seasonId}
                  onChange={(e) => setNewMatch({ ...newMatch, seasonId: e.target.value })}
                  required
                >
                  <option value="">Выберите сезон</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                placeholder="ID домашней команды"
                value={newMatch.homeTeamId}
                onChange={(e) => setNewMatch({ ...newMatch, homeTeamId: e.target.value })}
                required
              />
              <Input
                placeholder="ID гостевой команды"
                value={newMatch.awayTeamId}
                onChange={(e) => setNewMatch({ ...newMatch, awayTeamId: e.target.value })}
                required
              />
              <Input
                placeholder="Тур (weekLabel)"
                value={newMatch.weekLabel}
                onChange={(e) => setNewMatch({ ...newMatch, weekLabel: e.target.value })}
              />
              <Button type="submit">Создать матч</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Пересчёт рейтинга карточек</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
              value={recalcSeasonId}
              onChange={(e) => setRecalcSeasonId(e.target.value)}
            >
              <option value="">Завершённый сезон</option>
              {seasons
                .filter((s) => s.status === 'FINISHED')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <Button type="button" onClick={handleRecalc} disabled={!recalcSeasonId}>
              Пересчитать card rating (§12.3)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Матчи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            className="border-input bg-background flex h-10 rounded-md border px-3 text-sm"
            value={filterSeason}
            onChange={(e) => setFilterSeason(e.target.value)}
          >
            <option value="">Все сезоны</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Матч</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Стат.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    [{m.homeTeam.tag}] vs [{m.awayTeam.tag}] — {m.season.name}
                  </TableCell>
                  <TableCell>{m.status}</TableCell>
                  <TableCell>{m.statsCount}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelectedMatch(m.id)}>
                      Выбрать
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {loading && <p className="text-muted-foreground text-sm">Загрузка…</p>}
        </CardContent>
      </Card>

      {selectedMatch && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Ввод статистики — матч {selectedMatch.slice(0, 8)}…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Счёт дома</Label>
                <Input
                  type="number"
                  min={0}
                  value={scoreForm.homeScore}
                  onChange={(e) =>
                    setScoreForm({ ...scoreForm, homeScore: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Счёт гостей</Label>
                <Input
                  type="number"
                  min={0}
                  value={scoreForm.awayScore}
                  onChange={(e) =>
                    setScoreForm({ ...scoreForm, awayScore: Number(e.target.value) })
                  }
                />
              </div>
              <Button type="button" variant="outline" onClick={handleCompleteMatch}>
                Сохранить счёт
              </Button>
            </div>

            <form onSubmit={handleSubmitStats} className="space-y-4">
              {rows.map((row, index) => (
                <div
                  key={index}
                  className="border-border/50 grid gap-2 rounded-lg border p-3 sm:grid-cols-4 lg:grid-cols-6"
                >
                  <Input
                    placeholder="userId игрока"
                    value={row.userId}
                    onChange={(e) => updateRow(index, 'userId', e.target.value)}
                  />
                  <select
                    className="border-input bg-background h-10 rounded-md border px-2 text-sm"
                    value={row.positionPlayed}
                    onChange={(e) => updateRow(index, 'positionPlayed', e.target.value)}
                  >
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="% пасов"
                    value={row.passAccuracy}
                    onChange={(e) => updateRow(index, 'passAccuracy', Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    placeholder="Голы"
                    value={row.goals}
                    onChange={(e) => updateRow(index, 'goals', Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    placeholder="Ассисты"
                    value={row.assists}
                    onChange={(e) => updateRow(index, 'assists', Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    placeholder="Отборы"
                    value={row.tacklesWon}
                    onChange={(e) => updateRow(index, 'tacklesWon', Number(e.target.value))}
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRows((r) => [...r, emptyRow()])}
                >
                  + Игрок
                </Button>
                <Button type="submit">Сохранить статистику и XP</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
