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

import { getLeaderboard } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const players = await getLeaderboard();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Рейтинг игроков</h1>
        <p className="text-muted-foreground mt-2">
          Топ игроков PitchZone по рейтингу Elo ·{' '}
          <Link href="/leaderboard/xp" className="text-accent hover:underline">
            XP за сезон →
          </Link>
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Таблица лидеров</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Игрок</TableHead>
                <TableHead>Рейтинг</TableHead>
                <TableHead>W/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-display text-muted-foreground font-bold">
                    {player.rank}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/players/${player.id}`}
                      className="hover:text-accent flex items-center gap-2 font-medium"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={player.avatar ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {player.nickname?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {player.nickname}
                      {player.countryCode && (
                        <span className="text-muted-foreground text-xs">{player.countryCode}</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-accent font-mono font-bold">{player.rating}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {player.wins}/{player.losses}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
