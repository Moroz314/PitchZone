'use client';

import { motion } from 'framer-motion';

import { Badge, cn } from '@pitchzone/ui';

import { type BracketMatch } from '@/lib/mock-data';

interface BracketMockupProps {
  matches: BracketMatch[];
}

const ROUND_LABELS: Record<number, string> = {
  1: '1/4 финала',
  2: '1/2 финала',
  3: 'Финал',
};

function MatchNode({ match }: { match: BracketMatch }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'bg-card relative w-48 rounded-lg border p-3 transition-all',
        match.isActive && 'border-live shadow-glow-cyan',
        isLive && 'border-live/50',
        !match.isActive && !isLive && 'border-border',
      )}
    >
      {isLive && (
        <Badge variant="live" className="absolute -top-2.5 left-3 text-[10px]">
          LIVE
        </Badge>
      )}

      <div className="space-y-1.5">
        <div
          className={cn(
            'flex items-center justify-between rounded px-2 py-1 text-sm',
            isFinished && match.score1! > match.score2! && 'bg-accent/10 text-accent',
          )}
        >
          <span className="truncate">{match.player1}</span>
          {isFinished && <span className="font-mono font-bold">{match.score1}</span>}
        </div>
        <div
          className={cn(
            'flex items-center justify-between rounded px-2 py-1 text-sm',
            isFinished && match.score2! > match.score1! && 'bg-accent/10 text-accent',
          )}
        >
          <span className="truncate">{match.player2}</span>
          {isFinished && <span className="font-mono font-bold">{match.score2}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function BracketMockup({ matches }: BracketMockupProps) {
  const rounds = [1, 2, 3];

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-8 lg:gap-16">
        {rounds.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          return (
            <div key={round} className="flex flex-col">
              <h3 className="text-muted-foreground mb-4 text-center text-xs font-medium uppercase tracking-wider">
                {ROUND_LABELS[round]}
              </h3>
              <div
                className="flex flex-1 flex-col justify-around gap-6"
                style={{ minHeight: round === 1 ? 400 : round === 2 ? 300 : 150 }}
              >
                {roundMatches.map((match) => (
                  <div key={match.id} className="relative flex items-center">
                    <MatchNode match={match} />
                    {round < 3 && (
                      <div className="bg-border absolute -right-4 hidden h-px w-8 lg:block" />
                    )}
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
