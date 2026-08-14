'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@pitchzone/ui';

import {
  getTeamPendingInvites,
  inviteToTeam,
  removeTeamMember,
  type PendingTeamInvite,
  type TeamProfile,
} from '@/lib/api';

interface TeamManagementProps {
  team: TeamProfile;
}

export function TeamManagement({ team }: TeamManagementProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [pendingInvites, setPendingInvites] = useState<PendingTeamInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const myMembership = team.members.find((m) => m.id === session?.user?.id);
  const canManage = myMembership && ['OWNER', 'CAPTAIN'].includes(myMembership.role);

  useEffect(() => {
    if (!session?.accessToken || !canManage) return;
    getTeamPendingInvites(session.accessToken, team.id)
      .then(setPendingInvites)
      .catch(() => setPendingInvites([]));
  }, [session?.accessToken, team.id, canManage]);

  if (!canManage) return null;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !nickname.trim()) return;

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await inviteToTeam(session.accessToken, team.id, nickname.trim());
      setMessage(`Приглашение отправлено игроку ${nickname}`);
      setNickname('');
      const invites = await getTeamPendingInvites(session.accessToken, team.id);
      setPendingInvites(invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      await removeTeamMember(session.accessToken, team.id, userId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Управление командой</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-nickname">Пригласить по никнейму</Label>
            <Input
              id="invite-nickname"
              placeholder="NeonStriker"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading || !nickname.trim()}>
            {loading ? 'Отправка...' : 'Пригласить'}
          </Button>
        </form>

        {pendingInvites.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Ожидают ответа</p>
            <ul className="space-y-2">
              {pendingInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="border-border/50 flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{inv.nickname}</span>
                  <span className="text-muted-foreground">
                    до {new Date(inv.expiresAt).toLocaleDateString('ru-RU')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Удалить участника</p>
          <div className="flex flex-wrap gap-2">
            {team.members
              .filter((m) => m.role !== 'OWNER' && m.id !== session?.user?.id)
              .map((m) => (
                <Button
                  key={m.id}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => handleRemove(m.id)}
                >
                  Удалить {m.nickname}
                </Button>
              ))}
          </div>
        </div>

        {message && <p className="text-accent text-sm">{message}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
