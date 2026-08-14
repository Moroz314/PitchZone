'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@pitchzone/ui';

import {
  setMatchLive,
  updateMatchScore,
  type BracketMatch,
  type TournamentDetail,
} from '@/lib/api';

interface OrganizerMatchPanelProps {
  tournament: TournamentDetail;
}

export function OrganizerMatchPanel({ tournament }: OrganizerMatchPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeMatch, setActiveMatch] = useState<BracketMatch | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!session?.user?.id || session.user.id !== tournament.organizerId) {
    return null;
  }

  if (!['live', 'bracket_generated'].includes(tournament.status)) {
    return null;
  }

  const actionable = tournament.matches.filter(
    (m) =>
      m.status !== 'completed' &&
      m.player1 !== 'TBD' &&
      m.player2 !== 'TBD' &&
      m.player1 !== 'BYE' &&
      m.player2 !== 'BYE',
  );

  if (actionable.length === 0) return null;

  async function handleSetLive(matchId: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      await setMatchLive(session.accessToken, matchId);
      setMessage('Матч переведён в Live');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveScore() {
    if (!session?.accessToken || !activeMatch) return;
    setLoading(true);
    try {
      await updateMatchScore(
        session.accessToken,
        activeMatch.id,
        Number(score1),
        Number(score2),
      );
      setMessage('Счёт сохранён');
      setActiveMatch(null);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Управление матчами</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionable.slice(0, 6).map((match) => (
          <div
            key={match.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-3 text-sm"
          >
            <div>
              <span className="text-muted-foreground">R{match.round} · </span>
              {match.player1} vs {match.player2}
              {match.status === 'scheduled' && (
                <span className="ml-2 text-xs text-accent">запланирован</span>
              )}
              {(match.status === 'in_progress' || match.isActive) && (
                <span className="ml-2 text-xs text-live">IN PROGRESS</span>
              )}
            </div>
            <div className="flex gap-2">
              {match.status === 'scheduled' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => handleSetLive(match.id)}
                >
                  In Progress
                </Button>
              )}
              {(match.status === 'in_progress' ||
                match.status === 'awaiting_confirmation' ||
                match.status === 'scheduled') && (
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() => {
                    setActiveMatch(match);
                    setScore1(String(match.score1 ?? ''));
                    setScore2(String(match.score2 ?? ''));
                  }}
                >
                  Счёт
                </Button>
              )}
            </div>
          </div>
        ))}

        {activeMatch && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <p className="mb-3 text-sm font-medium">
              {activeMatch.player1} vs {activeMatch.player2}
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-20"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
              />
              <span>:</span>
              <Input
                type="number"
                min={0}
                className="w-20"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
              />
              <Button size="sm" onClick={handleSaveScore} disabled={loading}>
                Сохранить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setActiveMatch(null)}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-accent">{message}</p>}
      </CardContent>
    </Card>
  );
}
