import Link from 'next/link';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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

import { getCurrentSeason, getSeasonXpLeaderboard } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function XpLeaderboardPage() {
  const currentSeason = await getCurrentSeason().catch(() => null);
  const entries = currentSeason
    ? await getSeasonXpLeaderboard(currentSeason.id).catch(() => [])
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/leaderboard" className="text-muted-foreground hover:text-accent text-sm">
          ← Elo рейтинг
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold">XP за сезон</h1>
        <p className="text-muted-foreground mt-2">
          {currentSeason ? `Лидерборд по XP — ${currentSeason.name}` : 'Нет активного сезона'}
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Топ игроков по XP</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="text-muted-foreground p-4">
              Данных пока нет — StatTracker внесёт статистику после матчей
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Игрок</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Матчи</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.userId}>
                    <TableCell>{entry.rank}</TableCell>
                    <TableCell>
                      <Link
                        href={`/players/${entry.userId}`}
                        className="hover:text-accent flex items-center gap-2"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.avatar ?? undefined} />
                          <AvatarFallback>
                            {entry.nickname?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {entry.nickname}
                      </Link>
                    </TableCell>
                    <TableCell className="text-accent font-mono">{entry.cardRating}</TableCell>
                    <TableCell className="font-mono font-bold">{entry.totalXp}</TableCell>
                    <TableCell>{entry.matchesPlayed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
