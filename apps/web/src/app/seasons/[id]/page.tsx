import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Badge,
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

import { getSeason, getSeasonMatches, getSeasonStandings } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface SeasonPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: 'Скоро',
  REGISTRATION: 'Регистрация',
  ACTIVE: 'Идёт',
  FINISHED: 'Завершён',
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Скоро',
  COMPLETED: 'Итог',
  CANCELLED: 'Отменён',
};

export default async function SeasonDetailPage({ params }: SeasonPageProps) {
  const { id } = await params;

  let season;
  let standings;
  let matches;
  try {
    [season, standings, matches] = await Promise.all([
      getSeason(id),
      getSeasonStandings(id),
      getSeasonMatches(id),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/seasons" className="text-muted-foreground hover:text-accent text-sm">
        ← Все сезоны
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{season.name}</h1>
        <Badge>{STATUS_LABELS[season.status]}</Badge>
        {season.hasDivisions && <Badge variant="secondary">3 дивизиона</Badge>}
      </div>

      <p className="text-muted-foreground mt-2">
        {season.calendarLabel} · {season.year} · {season.entryCount} команд · взнос{' '}
        {season.entryFee > 0 ? `${season.entryFee} ₽` : 'бесплатно'}
      </p>

      {season.promotionRules.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Повышение / понижение</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            {season.promotionRules.map((rule) => (
              <div key={rule.id} className="border-border/50 rounded-lg border px-3 py-2">
                <span className="font-medium">{rule.divisionLabel}</span>
                <span className="text-muted-foreground">
                  {' '}
                  — ↑{rule.promoteTopN} / ↓{rule.relegateBottomN}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {matches.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Матчи сезона</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тур</TableHead>
                  <TableHead>Матч</TableHead>
                  <TableHead>Счёт</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">
                      {m.weekLabel ?? `Тур ${m.roundNumber}`}
                    </TableCell>
                    <TableCell>
                      <Link href={`/seasons/matches/${m.id}`} className="hover:text-accent">
                        [{m.homeTeam.tag}] vs [{m.awayTeam.tag}]
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">
                      {m.homeScore !== null && m.awayScore !== null
                        ? `${m.homeScore}:${m.awayScore}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.playedAt
                        ? new Date(m.playedAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {MATCH_STATUS_LABELS[m.status] ?? m.status}
                      </Badge>
                      {m.statsCount > 0 && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {m.statsCount} игр.
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 space-y-8">
        {standings.tables.map((table) => (
          <Card key={table.division?.id ?? 'all'}>
            <CardHeader>
              <CardTitle>{table.divisionLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Команда</TableHead>
                    <TableHead>О</TableHead>
                    <TableHead>И</TableHead>
                    <TableHead>В-Н-П</TableHead>
                    <TableHead>Мячи</TableHead>
                    <TableHead>±</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">
                        Команд пока нет
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.tablePosition ?? entry.finalPosition ?? '—'}</TableCell>
                        <TableCell>
                          <Link href={`/teams/${entry.team.id}`} className="hover:text-accent">
                            [{entry.team.tag}] {entry.team.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-accent font-mono">{entry.points}</TableCell>
                        <TableCell>{entry.matchesPlayed}</TableCell>
                        <TableCell>
                          {entry.wins}-{entry.draws}-{entry.losses}
                        </TableCell>
                        <TableCell>
                          {entry.goalsFor}:{entry.goalsAgainst}
                        </TableCell>
                        <TableCell>
                          {entry.goalDifference > 0 ? '+' : ''}
                          {entry.goalDifference}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
