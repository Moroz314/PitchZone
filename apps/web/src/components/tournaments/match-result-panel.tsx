'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@pitchzone/ui';

import {
  reportMatchScore,
  startMatch,
  type BracketMatch,
  type TournamentDetail,
} from '@/lib/api';

interface MatchResultPanelProps {
  tournament: TournamentDetail;
}

function isActionableMatch(match: BracketMatch): boolean {
  return (
    match.player1 !== 'TBD' &&
    match.player2 !== 'TBD' &&
    match.player1 !== 'BYE' &&
    match.player2 !== 'BYE' &&
    ['scheduled', 'in_progress', 'awaiting_confirmation'].includes(match.status)
  );
}

export function MatchResultPanel({ tournament }: MatchResultPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeMatch, setActiveMatch] = useState<BracketMatch | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const myParticipantIds = useMemo(() => {
    if (!session?.user?.id) return new Set<string>();
    return new Set(
      tournament.participants
        .filter((p) => p.userId === session.user.id)
        .map((p) => p.id),
    );
  }, [session?.user?.id, tournament.participants]);

  const myMatches = useMemo(() => {
    if (myParticipantIds.size === 0) return [];
    return tournament.matches.filter(
      (m) =>
        isActionableMatch(m) &&
        ((m.participant1Id && myParticipantIds.has(m.participant1Id)) ||
          (m.participant2Id && myParticipantIds.has(m.participant2Id))),
    );
  }, [tournament.matches, myParticipantIds]);

  if (!session?.user?.id || tournament.status !== 'live') {
    return null;
  }

  if (myMatches.length === 0) return null;

  async function handleStart(matchId: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    setMessage('');
    try {
      await startMatch(session.accessToken, matchId);
      setMessage('Матч начался — играйте и отправьте результат');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!session?.accessToken || !activeMatch || !proofFile) return;
    setLoading(true);
    setMessage('');
    try {
      await reportMatchScore(
        session.accessToken,
        activeMatch.id,
        Number(score1),
        Number(score2),
        proofFile,
      );
      setMessage('Результат отправлен. Ожидаем подтверждения соперника.');
      setActiveMatch(null);
      setProofFile(null);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6 border-accent/30">
      <CardHeader>
        <CardTitle className="text-base">Ваши матчи</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Отправьте счёт и пруф (скриншот или видео). Матч завершится, когда оба игрока
          укажут одинаковый результат.
        </p>

        {myMatches.map((match) => (
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
              {match.status === 'in_progress' && (
                <span className="ml-2 text-xs text-live">идёт</span>
              )}
              {match.status === 'awaiting_confirmation' && (
                <span className="ml-2 text-xs text-yellow-400">ожидание подтверждения</span>
              )}
              {match.status === 'disputed' && (
                <span className="ml-2 text-xs text-destructive">спор</span>
              )}
            </div>
            <div className="flex gap-2">
              {match.status === 'scheduled' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => handleStart(match.id)}
                >
                  Начать матч
                </Button>
              )}
              {(match.status === 'in_progress' || match.status === 'awaiting_confirmation') && (
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() => {
                    setActiveMatch(match);
                    setScore1('');
                    setScore2('');
                    setProofFile(null);
                  }}
                >
                  Отправить результат
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  placeholder="Счёт 1"
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                />
                <span>:</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  placeholder="Счёт 2"
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Пруф ({tournament.proofRequirement === 'VIDEO' ? 'видео' : 'скриншот'})
                </label>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={loading || !proofFile || score1 === '' || score2 === ''}
                >
                  Отправить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setActiveMatch(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-accent">{message}</p>}
      </CardContent>
    </Card>
  );
}
