import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@pitchzone/ui';

import { EaMatchPlayersTable } from '@/components/seasons/ea-match-players-table';
import { getTournamentMatchDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface TournamentMatchPageProps {
  params: Promise<{ id: string }>;
}

const EA_SYNC_LABELS: Record<string, string> = {
  AWAITING_EA: 'Ожидание EA',
  SYNCED: 'EA Sync · FIFA stats',
  NEEDS_REVIEW: 'Требуется ручной ввод',
  MANUAL: 'Счёт введён вручную',
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

export default async function TournamentMatchPage({ params }: TournamentMatchPageProps) {
  const { id } = await params;

  let match;
  try {
    match = await getTournamentMatchDetail(id);
  } catch {
    notFound();
  }

  const score =
    match.score1 !== null && match.score2 !== null ? `${match.score1} : ${match.score2}` : '— : —';

  const syncLabel = match.eaSyncStatus ? EA_SYNC_LABELS[match.eaSyncStatus] : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={`/tournaments/${match.tournament.slug}`}
        className="text-muted-foreground hover:text-accent text-sm"
      >
        ← {match.tournament.title}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge>{match.status}</Badge>
        <Badge variant="secondary">Раунд {match.round}</Badge>
        {syncLabel && (
          <Badge variant={match.eaSyncStatus === 'SYNCED' ? 'default' : 'outline'}>
            {syncLabel}
          </Badge>
        )}
        {match.eaSyncNote && (
          <span className="text-muted-foreground text-xs">{match.eaSyncNote}</span>
        )}
      </div>

      <div className="border-border/60 bg-card/50 mt-8 rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground text-sm">{formatDate(match.playedAt)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          <div className="min-w-[120px] text-right">
            {match.team1.id ? (
              <Link
                href={`/teams/${match.team1.id}`}
                className="font-display hover:text-accent text-xl font-bold"
              >
                [{match.team1.tag}]
              </Link>
            ) : (
              <span className="font-display text-xl font-bold">[{match.team1.tag}]</span>
            )}
            <p className="text-muted-foreground text-sm">{match.team1.name}</p>
          </div>
          <div className="font-display text-accent text-5xl font-bold tracking-wider">{score}</div>
          <div className="min-w-[120px] text-left">
            {match.team2.id ? (
              <Link
                href={`/teams/${match.team2.id}`}
                className="font-display hover:text-accent text-xl font-bold"
              >
                [{match.team2.tag}]
              </Link>
            ) : (
              <span className="font-display text-xl font-bold">[{match.team2.tag}]</span>
            )}
            <p className="text-muted-foreground text-sm">{match.team2.name}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          {match.statsCount} игроков · полная статистика из EA Pro Clubs
        </p>
      </div>

      <div className="mt-10 space-y-8">
        <EaMatchPlayersTable
          teamTag={match.team1.tag}
          teamName={match.team1.name}
          players={match.team1EaPlayers}
        />
        <EaMatchPlayersTable
          teamTag={match.team2.tag}
          teamName={match.team2.name}
          players={match.team2EaPlayers}
        />
      </div>
    </div>
  );
}
