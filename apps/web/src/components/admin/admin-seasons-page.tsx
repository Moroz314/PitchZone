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
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import { AdminShell } from '@/components/admin/admin-shell';
import {
  calculateAdminAnnual,
  createAdminSeason,
  deleteAdminSeason,
  finishAdminSeason,
  getAdminSeasons,
  getSeasonStandings,
  setAdminPromotionRules,
  updateAdminSeason,
  updateAdminSeasonEntry,
  type SeasonStandings,
  type SeasonSummary,
} from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: 'Скоро',
  REGISTRATION: 'Регистрация',
  ACTIVE: 'Идёт',
  FINISHED: 'Завершён',
};

const CALENDAR_SLOTS = [
  { id: 'AUTUMN_WINTER', label: 'Осень-зима' },
  { id: 'WINTER_SPRING', label: 'Зима-весна' },
  { id: 'SPRING_SUMMER', label: 'Весна-лето' },
];

export function AdminSeasonsPage() {
  const { data: session } = useSession();
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [standings, setStandings] = useState<SeasonStandings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    year: new Date().getFullYear(),
    calendarSlot: 'AUTUMN_WINTER',
    startDate: '',
    endDate: '',
    hasDivisions: false,
    entryFee: 0,
    status: 'UPCOMING' as const,
  });

  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      setSeasons(await getAdminSeasons(session.accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadStandings(seasonId: string) {
    if (!session?.accessToken) return;
    setSelectedId(seasonId);
    setStandings(await getSeasonStandings(seasonId));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError('');
    try {
      await createAdminSeason(session.accessToken, {
        name: form.name,
        type: 'REGULAR',
        year: form.year,
        calendarSlot: form.calendarSlot,
        startDate: form.startDate,
        endDate: form.endDate,
        hasDivisions: form.hasDivisions,
        entryFee: form.entryFee,
        status: form.status,
      });
      setMessage('Сезон создан');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function setStatus(season: SeasonSummary, status: SeasonSummary['status']) {
    if (!session?.accessToken) return;
    await updateAdminSeason(session.accessToken, season.id, { status });
    setMessage(`Статус «${STATUS_LABELS[status]}»`);
    await load();
  }

  async function handleFinish(seasonId: string) {
    if (!session?.accessToken) return;
    await finishAdminSeason(session.accessToken, seasonId);
    setMessage('Сезон завершён, итоговые места рассчитаны');
    await load();
    await loadStandings(seasonId);
  }

  async function handlePromotionRules(season: SeasonSummary) {
    if (!session?.accessToken || !season.hasDivisions) return;
    const rules = season.divisions.map((d) => ({
      divisionId: d.id,
      promoteTopN: d.name === 'BRONZE' ? 2 : d.name === 'SILVER' ? 2 : 0,
      relegateBottomN: d.name === 'GOLD' ? 2 : d.name === 'SILVER' ? 2 : 0,
    }));
    await setAdminPromotionRules(session.accessToken, season.id, rules);
    setMessage('Правила promotion/relegation сохранены (шаблон 2↑/2↓)');
    await load();
  }

  async function handleCalculateAnnual() {
    if (!session?.accessToken) return;
    const result = await calculateAdminAnnual(session.accessToken, annualYear);
    setMessage(`Годовой зачёт ${annualYear}: топ-${result.qualifyTopN} на LAN`);
  }

  async function updateEntryPoints(
    seasonId: string,
    entryId: string,
    field: 'points' | 'wins' | 'draws' | 'losses',
    value: number,
  ) {
    if (!session?.accessToken) return;
    await updateAdminSeasonEntry(session.accessToken, seasonId, entryId, { [field]: value });
    await loadStandings(seasonId);
  }

  return (
    <AdminShell>
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Создать сезон платформы</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Осень-зима 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Год</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Слот календаря</Label>
                  <select
                    className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                    value={form.calendarSlot}
                    onChange={(e) => setForm({ ...form, calendarSlot: e.target.value })}
                  >
                    {CALENDAR_SLOTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Начало</Label>
                  <Input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Окончание</Label>
                  <Input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasDivisions}
                  onChange={(e) => setForm({ ...form, hasDivisions: e.target.checked })}
                />
                Дивизионы (Золото / Серебро / Бронза)
              </label>
              <p className="text-muted-foreground text-xs">
                Первый сезон платформы — без дивизионов. Со второго — включите чекбокс.
              </p>
              <Button type="submit">Создать сезон</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Годовой зачёт и LAN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Год расчёта</Label>
              <Input
                type="number"
                value={annualYear}
                onChange={(e) => setAnnualYear(Number(e.target.value))}
              />
            </div>
            <Button type="button" onClick={handleCalculateAnnual}>
              Рассчитать годовой зачёт
            </Button>
            <p className="text-muted-foreground text-xs">
              Суммирует очки завершённых REGULAR-сезонов года с учётом веса lanPointsWeight.
            </p>
            <Link href="/lan" className="text-accent text-sm hover:underline">
              Открыть «Путь на LAN» →
            </Link>
          </CardContent>
        </Card>
      </div>

      {message && <p className="text-accent mt-4 text-sm">{message}</p>}
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Сезоны ({seasons.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground p-4">Загрузка…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сезон</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Команд</TableHead>
                  <TableHead>Дивизионы</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map((season) => (
                  <TableRow key={season.id}>
                    <TableCell>
                      <div className="font-medium">{season.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {season.calendarLabel ?? season.calendarSlot} · {season.year}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">{STATUS_LABELS[season.status]}</Badge>
                        {season.isPublic === false && (
                          <Badge variant="outline" className="text-muted-foreground">
                            скрыт
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{season.entryCount}</TableCell>
                    <TableCell>
                      {season.hasDivisions
                        ? `${season.divisions.length} ${season.divisions.length === 1 ? 'лига' : season.divisions.length < 5 ? 'лиги' : 'лиг'}`
                        : 'Общая группа'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {season.status === 'UPCOMING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(season, 'REGISTRATION')}
                          >
                            Открыть регистрацию
                          </Button>
                        )}
                        {season.status === 'REGISTRATION' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(season, 'ACTIVE')}
                          >
                            Старт
                          </Button>
                        )}
                        {season.status === 'ACTIVE' && (
                          <Button size="sm" onClick={() => handleFinish(season.id)}>
                            Завершить
                          </Button>
                        )}
                        {season.hasDivisions && season.status !== 'FINISHED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePromotionRules(season)}
                          >
                            P/R правила
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => loadStandings(season.id)}>
                          Таблица
                        </Button>
                        {season.status === 'UPCOMING' &&
                          season.entryCount === 0 &&
                          session?.accessToken && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={async () => {
                                await deleteAdminSeason(session.accessToken!, season.id);
                                await load();
                              }}
                            >
                              Удалить
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {standings && selectedId && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Таблицы сезона</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {standings.tables.map((table) => (
              <div key={table.division?.id ?? 'all'}>
                <h3 className="font-display mb-3 text-lg font-semibold">{table.divisionLabel}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Команда</TableHead>
                      <TableHead>О</TableHead>
                      <TableHead>И</TableHead>
                      <TableHead>В</TableHead>
                      <TableHead>Н</TableHead>
                      <TableHead>П</TableHead>
                      <TableHead>Мячи</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.tablePosition}</TableCell>
                        <TableCell>
                          [{entry.team.tag}] {entry.team.name}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-16"
                            type="number"
                            defaultValue={entry.points}
                            onBlur={(e) =>
                              updateEntryPoints(
                                selectedId,
                                entry.id,
                                'points',
                                Number(e.target.value),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>{entry.matchesPlayed}</TableCell>
                        <TableCell>{entry.wins}</TableCell>
                        <TableCell>{entry.draws}</TableCell>
                        <TableCell>{entry.losses}</TableCell>
                        <TableCell>
                          {entry.goalsFor}:{entry.goalsAgainst}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
