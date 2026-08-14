import Link from 'next/link';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@pitchzone/ui';

import { getCurrentSeason, getSeasons } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: 'Скоро',
  REGISTRATION: 'Регистрация открыта',
  ACTIVE: 'Сезон идёт',
  FINISHED: 'Завершён',
};

export default async function SeasonsPage() {
  const [seasons, current] = await Promise.all([
    getSeasons().catch(() => []),
    getCurrentSeason().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-muted-foreground hover:text-accent text-sm">
            ← На главную
          </Link>
          <h1 className="font-display mt-4 text-3xl font-bold">Сезоны платформы</h1>
          <p className="text-muted-foreground mt-2">
            Официальные лиги режима «Клубы 11 на 11» — Осень-зима, Зима-весна, Весна-лето
          </p>
        </div>
        <Link href="/lan" className="text-accent text-sm font-medium hover:underline">
          Путь на LAN →
        </Link>
      </div>

      {current && (
        <Card className="border-accent/30 bg-accent/5 mb-8">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Текущий сезон
              <Badge>{STATUS_LABELS[current.status] ?? current.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/seasons/${current.id}`}
              className="font-display hover:text-accent text-xl font-bold"
            >
              {current.name}
            </Link>
            <p className="text-muted-foreground mt-2 text-sm">
              {current.calendarLabel} · {current.entryCount} команд ·{' '}
              {current.hasDivisions ? 'Золото / Серебро / Бронза' : 'Общая группа'}
            </p>
            {current.status === 'REGISTRATION' && (
              <p className="text-accent mt-3 text-sm">
                Капитаны клубов могут подать заявку в разделе «Мой клуб» на странице команды.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {seasons.map((season) => (
          <Card key={season.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/seasons/${season.id}`} className="hover:text-accent font-medium">
                  {season.name}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {season.calendarLabel ?? season.calendarSlot} · {season.year} ·{' '}
                  {season.entryCount} команд
                </p>
              </div>
              <Badge variant="outline">{STATUS_LABELS[season.status]}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
