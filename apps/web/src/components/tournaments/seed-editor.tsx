'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@pitchzone/ui';

import {
  getTournamentBracket,
  updateTournamentSeeds,
  type BracketSeedParticipant,
  type TournamentDetail,
} from '@/lib/api';

interface SeedEditorProps {
  tournament: TournamentDetail;
}

export function SeedEditor({ tournament }: SeedEditorProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [participants, setParticipants] = useState<BracketSeedParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = ['registration_closed', 'bracket_generated'].includes(tournament.status);

  useEffect(() => {
    if (!canEdit) return;
    getTournamentBracket(tournament.id)
      .then((data) => setParticipants(data.participants))
      .catch(() => setParticipants([]));
  }, [tournament.id, canEdit]);

  if (!canEdit || participants.length < 2) return null;

  function moveSeed(index: number, direction: -1 | 1) {
    const next = [...participants];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setParticipants(
      next.map((p, i) => ({ ...p, seed: i + 1 })),
    );
  }

  async function handleSave() {
    if (!session?.accessToken) return;
    setLoading(true);
    setMessage('');
    try {
      await updateTournamentSeeds(
        session.accessToken,
        tournament.id,
        participants.map((p) => ({ participantId: p.id, seed: p.seed })),
      );
      setMessage('Посев обновлён, сетка пересобрана');
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
        <CardTitle className="text-base">Посев участников</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Измените порядок до старта турнира. Сильные игроки автоматически разводятся по разным
          половинам сетки.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Участник</TableHead>
              <TableHead>Рейтинг</TableHead>
              <TableHead className="w-24">Порядок</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p, index) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-accent">{p.seed}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.rating ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={index === 0}
                      onClick={() => moveSeed(index, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={index === participants.length - 1}
                      onClick={() => moveSeed(index, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Применить посев'}
          </Button>
          {message && <span className="text-sm text-accent">{message}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
