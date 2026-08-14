import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@pitchzone/ui';

import { EaMatchPlayersTable } from '@/components/seasons/ea-match-players-table';
import { getSeasonMatchDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирован',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SeasonMatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  let match;
  try {
    match = await getSeasonMatchDetail(id);
  } catch {
    notFound();
  }

  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} : ${match.awayScore}`
      : '— : —';

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={`/seasons/${match.season.id}`}
        className="text-muted-foreground hover:text-accent text-sm"
      >
        ← {match.season.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge>{STATUS_LABELS[match.status] ?? match.status}</Badge>
        {match.weekLabel && <Badge variant="secondary">{match.weekLabel}</Badge>}
        {match.eaMatchId && <Badge variant="outline">EA Sync · FIFA stats</Badge>}
      </div>

      <div className="border-border/60 bg-card/50 mt-8 rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground text-sm">{formatDate(match.playedAt)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          <div className="min-w-[120px] text-right">
            <Link
              href={`/teams/${match.homeTeam.id}`}
              className="font-display hover:text-accent text-xl font-bold"
            >
              [{match.homeTeam.tag}]
            </Link>
            <p className="text-muted-foreground text-sm">{match.homeTeam.name}</p>
          </div>
          <div className="font-display text-accent text-5xl font-bold tracking-wider">{score}</div>
          <div className="min-w-[120px] text-left">
            <Link
              href={`/teams/${match.awayTeam.id}`}
              className="font-display hover:text-accent text-xl font-bold"
            >
              [{match.awayTeam.tag}]
            </Link>
            <p className="text-muted-foreground text-sm">{match.awayTeam.name}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          {match.statsCount} игроков · полная статистика из EA Pro Clubs
        </p>
      </div>

      <div className="mt-10 space-y-8">
        <EaMatchPlayersTable
          teamTag={match.homeTeam.tag}
          teamName={match.homeTeam.name}
          players={match.homeEaPlayers}
        />
        <EaMatchPlayersTable
          teamTag={match.awayTeam.tag}
          teamName={match.awayTeam.name}
          players={match.awayEaPlayers}
        />
      </div>
    </div>
  );
}
