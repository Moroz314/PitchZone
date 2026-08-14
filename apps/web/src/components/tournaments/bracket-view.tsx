'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import { Badge, cn } from '@pitchzone/ui';

import { type BracketMatch } from '@/lib/api';

interface BracketViewProps {
  matches: BracketMatch[];
}

const EA_SYNC_BADGE: Record<
  NonNullable<BracketMatch['eaSyncStatus']>,
  { label: string; className: string }
> = {
  awaiting_ea: { label: 'EA', className: 'border-blue-500/50 text-blue-400' },
  synced: { label: 'EA ✓', className: 'border-accent/50 text-accent' },
  needs_review: { label: 'EA ?', className: 'border-yellow-500/50 text-yellow-400' },
  manual: { label: 'Manual', className: 'border-muted-foreground/50 text-muted-foreground' },
};

function getRoundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return 'Финал';
  if (fromFinal === 1) return '1/2 финала';
  if (fromFinal === 2) return '1/4 финала';
  if (fromFinal === 3) return '1/8 финала';
  return `Раунд ${round}`;
}

function MatchNode({ match }: { match: BracketMatch }) {
  const isLive = match.status === 'in_progress' || match.isActive;
  const isScheduled = match.status === 'scheduled';
  const isAwaiting = match.status === 'awaiting_confirmation';
  const isDisputed = match.status === 'disputed';
  const isFinished = match.status === 'completed';
  const eaBadge = match.eaSyncStatus ? EA_SYNC_BADGE[match.eaSyncStatus] : null;
  const canOpenDetail = isFinished || match.eaSyncStatus === 'synced';

  const inner = (
    <>
      {isLive && (
        <Badge variant="live" className="absolute -top-2.5 left-3 text-[10px]">
          LIVE
        </Badge>
      )}
      {isScheduled && !isLive && (
        <Badge variant="open" className="absolute -top-2.5 left-3 text-[10px]">
          SCHEDULED
        </Badge>
      )}
      {isAwaiting && (
        <Badge
          variant="outline"
          className="absolute -top-2.5 left-3 border-yellow-500/50 text-[10px] text-yellow-400"
        >
          CONFIRM
        </Badge>
      )}
      {isDisputed && (
        <Badge variant="destructive" className="absolute -top-2.5 left-3 text-[10px]">
          DISPUTE
        </Badge>
      )}
      {eaBadge && !isLive && !isAwaiting && !isDisputed && (
        <Badge
          variant="outline"
          className={cn('absolute -top-2.5 right-3 text-[10px]', eaBadge.className)}
        >
          {eaBadge.label}
        </Badge>
      )}

      <div className="space-y-1.5">
        <div
          className={cn(
            'flex items-center justify-between rounded px-2 py-1 text-sm',
            isFinished &&
              match.score1 !== undefined &&
              match.score2 !== undefined &&
              match.score1 > match.score2 &&
              'bg-accent/10 text-accent',
          )}
        >
          <span className="truncate">{match.player1}</span>
          {(isFinished || isDisputed) && match.score1 !== undefined && (
            <span className="font-mono font-bold">{match.score1}</span>
          )}
        </div>
        <div
          className={cn(
            'flex items-center justify-between rounded px-2 py-1 text-sm',
            isFinished &&
              match.score1 !== undefined &&
              match.score2 !== undefined &&
              match.score2 > match.score1 &&
              'bg-accent/10 text-accent',
          )}
        >
          <span className="truncate">{match.player2}</span>
          {(isFinished || isDisputed) && match.score2 !== undefined && (
            <span className="font-mono font-bold">{match.score2}</span>
          )}
        </div>
      </div>
    </>
  );

  const className = cn(
    'relative block w-48 rounded-lg border bg-card p-3 text-left transition-all',
    canOpenDetail && 'hover:ring-1 hover:ring-accent/40',
    isLive && 'border-live shadow-glow-cyan',
    isDisputed && 'border-destructive/60',
    isAwaiting && 'border-yellow-500/50',
    isScheduled && !isLive && 'border-accent/40',
    !isLive && !isScheduled && !isDisputed && !isAwaiting && 'border-border',
  );

  if (canOpenDetail) {
    return (
      <Link href={`/tournaments/matches/${match.id}`} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={className}
    >
      {inner}
    </motion.div>
  );
}

export function BracketView({ matches }: BracketViewProps) {
  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        Сетка ещё не сгенерирована. После закрытия регистрации она создаётся автоматически.
      </p>
    );
  }

  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const totalRounds = rounds[rounds.length - 1];

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-8 lg:gap-16">
        {rounds.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          return (
            <div key={round} className="flex flex-col">
              <h3 className="text-muted-foreground mb-4 text-center text-xs font-medium uppercase tracking-wider">
                {getRoundLabel(round, totalRounds)}
              </h3>
              <div
                className="flex flex-1 flex-col justify-around gap-6"
                style={{
                  minHeight: round === rounds[0] ? Math.max(300, roundMatches.length * 90) : 200,
                }}
              >
                {roundMatches.map((match) => (
                  <div key={match.id} className="relative flex items-center">
                    <MatchNode match={match} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
