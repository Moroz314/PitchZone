import Link from 'next/link';

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

import { getLanPath } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface LanPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function LanPathPage({ searchParams }: LanPageProps) {
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : undefined;
  const data = await getLanPath(year).catch(() => ({
    year: year ?? new Date().getFullYear(),
    calculated: false,
    qualifyTopN: 8,
    standings: [],
    message: 'Не удалось загрузить данные',
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/seasons" className="text-sm text-muted-foreground hover:text-accent">
        ← Сезоны
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold">Путь на LAN</h1>
      <p className="mt-2 text-muted-foreground">
        Годовой командный зачёт за {data.year}. Топ-{data.qualifyTopN} команд получают приглашение на
        офлайн LAN-турнир.
      </p>

      {!data.calculated && (
        <Card className="mt-6">
          <CardContent className="p-4 text-muted-foreground">
            {data.message ?? 'Годовой зачёт ещё не рассчитан'}
          </CardContent>
        </Card>
      )}

      {data.standings.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Годовой рейтинг {data.year}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Место</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead>Очки</TableHead>
                  <TableHead>Сезонов</TableHead>
                  <TableHead>LAN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.standings.map((row) => (
                  <TableRow key={row.team.id}>
                    <TableCell className="font-mono">{row.rank ?? '—'}</TableCell>
                    <TableCell>
                      <Link href={`/teams/${row.team.id}`} className="hover:text-accent">
                        [{row.team.tag}] {row.team.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-accent">
                      {Math.round(row.totalPoints * 10) / 10}
                    </TableCell>
                    <TableCell>{row.seasonsPlayed}</TableCell>
                    <TableCell>
                      {row.qualifiedForLan ? (
                        <Badge className="bg-accent text-accent-foreground">Квалификация</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex gap-2 text-sm">
        {[data.year - 1, data.year, data.year + 1].map((y) => (
          <Link
            key={y}
            href={`/lan?year=${y}`}
            className={y === data.year ? 'font-medium text-accent' : 'text-muted-foreground hover:text-accent'}
          >
            {y}
          </Link>
        ))}
      </div>
    </div>
  );
}
