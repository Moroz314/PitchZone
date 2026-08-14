'use client';

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

import { Suspense } from 'react';

import { BracketView } from '@/components/tournaments/bracket-view';
import { TournamentLeagueTable } from '@/components/tournaments/tournament-league-table';
import { MatchResultPanel } from '@/components/tournaments/match-result-panel';
import { OrganizerControls } from '@/components/tournaments/organizer-controls';
import { OrganizerEditPanel } from '@/components/tournaments/organizer-edit-panel';
import { PrivateTournamentInvites } from '@/components/tournaments/private-tournament-invites';
import { OrganizerMatchPanel } from '@/components/tournaments/organizer-match-panel';
import { SeedEditor } from '@/components/tournaments/seed-editor';
import { TournamentResults } from '@/components/tournaments/tournament-results';
import { TournamentHero } from '@/components/tournaments/tournament-hero';
import { useTournamentSocket } from '@/hooks/use-tournament-socket';
import { type TournamentDetail } from '@/lib/api';

interface TournamentPageClientProps {
  initialTournament: TournamentDetail;
}

export function TournamentPageClient({ initialTournament }: TournamentPageClientProps) {
  const { tournament, connected } = useTournamentSocket({
    slug: initialTournament.slug,
    initialTournament,
  });

  const isRoundRobin = tournament.formatKey === 'ROUND_ROBIN';
  const groupMatches = isRoundRobin ? tournament.matches.filter((m) => m.round === 1) : [];
  const playoffMatches = isRoundRobin
    ? tournament.matches.filter((m) => m.round > 1)
    : tournament.matches;

  return (
    <>
      <Suspense fallback={null}>
        <TournamentHero tournament={tournament} />
      </Suspense>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <TournamentResults tournament={tournament} />
        <PrivateTournamentInvites tournament={tournament} />
        <OrganizerControls tournament={tournament} />
        <OrganizerEditPanel tournament={tournament} />
        <SeedEditor tournament={tournament} />
        <MatchResultPanel tournament={tournament} />
        <OrganizerMatchPanel tournament={tournament} />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Турнирная таблица</CardTitle>
                  <div className="flex items-center gap-2">
                    {tournament.status === 'live' && connected && (
                      <Badge variant="live">Live обновления</Badge>
                    )}
                    {tournament.status === 'live' && !connected && (
                      <Badge variant="outline">Offline</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TournamentLeagueTable
                  title={tournament.title}
                  groupLabel={isRoundRobin ? 'Группа 1' : undefined}
                  entries={tournament.leagueTable ?? []}
                />
              </CardContent>
            </Card>

            {groupMatches.length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Матчи группового этапа</CardTitle>
                </CardHeader>
                <CardContent>
                  <BracketView matches={groupMatches} />
                </CardContent>
              </Card>
            )}

            {playoffMatches.length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>{isRoundRobin ? 'Плей-офф' : 'Сетка матчей'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <BracketView matches={playoffMatches} />
                </CardContent>
              </Card>
            )}

            {!isRoundRobin && tournament.matches.length === 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Сетка матчей</CardTitle>
                </CardHeader>
                <CardContent>
                  <BracketView matches={[]} />
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Участники ({tournament.participants.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tournament.participants.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Пока нет участников</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Игрок</TableHead>
                        <TableHead>Рейтинг</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tournament.participants.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-muted-foreground">{p.seed}</TableCell>
                          <TableCell className="font-medium">
                            {p.userId ? (
                              <Link href={`/players/${p.userId}`} className="hover:text-accent">
                                {p.name}
                              </Link>
                            ) : (
                              p.name
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-accent">
                            {p.rating ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
