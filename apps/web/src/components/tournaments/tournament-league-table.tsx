'use client';

import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@pitchzone/ui';

import { type TournamentLeagueEntry } from '@/lib/api';

interface TournamentLeagueTableProps {
  title: string;
  groupLabel?: string;
  entries: TournamentLeagueEntry[];
}

function TeamAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />;
  }

  return (
    <div className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase">
      {name.slice(0, 2)}
    </div>
  );
}

export function TournamentLeagueTable({ title, groupLabel, entries }: TournamentLeagueTableProps) {
  const [open, setOpen] = useState(true);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Таблица появится после регистрации участников и генерации сетки.
      </p>
    );
  }

  return (
    <div className="border-border/60 bg-card overflow-hidden rounded-lg border">
      <button
        type="button"
        className="border-border/60 bg-muted/40 flex w-full items-center justify-between border-b px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {groupLabel && (
            <div className="border-border/40 bg-muted/20 text-muted-foreground border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              {groupLabel}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-border/60 bg-muted/30 text-muted-foreground border-b text-xs uppercase tracking-wide">
                  <th className="w-10 px-3 py-2.5 text-left font-medium">#</th>
                  <th className="px-3 py-2.5 text-left font-medium">Команда</th>
                  <th className="w-10 px-2 py-2.5 text-center font-medium">И</th>
                  <th className="w-10 px-2 py-2.5 text-center font-medium">В</th>
                  <th className="w-10 px-2 py-2.5 text-center font-medium">П</th>
                  <th className="w-16 px-2 py-2.5 text-center font-medium">З:П</th>
                  <th className="w-14 px-3 py-2.5 text-center font-medium">Очки</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, index) => {
                  const href = row.teamId
                    ? `/teams/${row.teamId}`
                    : row.userId
                      ? `/players/${row.userId}`
                      : null;

                  return (
                    <tr
                      key={row.participantId}
                      className={cn(
                        'border-border/30 hover:bg-muted/20 border-b transition-colors',
                        index === 0 && row.points > 0 && 'bg-accent/5',
                      )}
                    >
                      <td className="text-muted-foreground px-3 py-2.5">{row.position}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <TeamAvatar name={row.name} avatarUrl={row.avatarUrl} />
                          {href ? (
                            <Link href={href} className="hover:text-accent font-medium">
                              {row.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{row.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{row.matchesPlayed}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{row.wins}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{row.losses}</td>
                      <td className="text-muted-foreground px-2 py-2.5 text-center tabular-nums">
                        {row.goalsFor}:{row.goalsAgainst}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-accent font-semibold tabular-nums">{row.points}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
