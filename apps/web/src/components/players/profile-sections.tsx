import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

export interface ProfileHeaderData {
  id: string;
  nickname: string;
  country: string;
  countryCode: string;
  rating: number;
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentsPlayed: number;
  joinedAt: string;
}

interface MatchHistoryProps {
  matches: {
    id: string;
    opponent: string;
    score: string;
    result: 'win' | 'loss';
    tournament: string;
    date: string;
  }[];
}

export function MatchHistory({ matches }: MatchHistoryProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Соперник</TableHead>
          <TableHead>Счёт</TableHead>
          <TableHead>Турнир</TableHead>
          <TableHead>Дата</TableHead>
          <TableHead>Результат</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((match) => (
          <TableRow key={match.id}>
            <TableCell className="font-medium">{match.opponent}</TableCell>
            <TableCell className="font-mono">{match.score}</TableCell>
            <TableCell className="text-muted-foreground">{match.tournament}</TableCell>
            <TableCell className="text-muted-foreground">{match.date}</TableCell>
            <TableCell>
              <Badge variant={match.result === 'win' ? 'success' : 'destructive'}>
                {match.result === 'win' ? 'Победа' : 'Поражение'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface ProfileHeaderProps {
  player: ProfileHeaderData;
}

export function ProfileHeader({ player }: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="from-accent/30 to-accent-cyan/20 font-display text-accent flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl font-bold">
        {player.nickname.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{player.nickname}</h1>
          <Badge variant="outline">{player.countryCode}</Badge>
          <Badge variant="secondary">#{player.rank} в рейтинге</Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          {player.country} · с {player.joinedAt}
        </p>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Рейтинг </span>
            <span className="font-display text-accent text-xl font-bold">{player.rating}</span>
          </div>
          <div>
            <span className="text-muted-foreground">W/L </span>
            <span className="font-medium">
              {player.wins}/{player.losses}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Win Rate </span>
            <span className="font-medium">{player.winRate}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Турниры </span>
            <span className="font-medium">{player.tournamentsPlayed}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
