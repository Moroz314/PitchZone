'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pitchzone/ui';

import { acceptTeamInvite, declineTeamInvite, getMyTeamInvites, type TeamInvite } from '@/lib/api';

export default function InvitesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/invites');
      return;
    }
    if (!session?.accessToken) return;

    getMyTeamInvites(session.accessToken)
      .then(setInvites)
      .catch(() => setInvites([]));
  }, [session?.accessToken, status, router]);

  async function handleAccept(invite: TeamInvite) {
    if (!session?.accessToken) return;
    setLoadingId(invite.id);
    setError('');
    try {
      const team = await acceptTeamInvite(session.accessToken, invite.teamId, invite.id);
      router.push(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setLoadingId(null);
    }
  }

  async function handleDecline(inviteId: string) {
    if (!session?.accessToken) return;
    setLoadingId(inviteId);
    setError('');
    try {
      await declineTeamInvite(session.accessToken, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold">Приглашения в команды</h1>
      <p className="mt-2 text-muted-foreground">Подтвердите или отклоните приглашения</p>

      <div className="mt-8 space-y-4">
        {invites.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Нет активных приглашений
            </CardContent>
          </Card>
        ) : (
          invites.map((invite) => (
            <Card key={invite.id}>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  {invite.team.avatar ? (
                    <Avatar className="h-12 w-12 rounded-xl">
                      <AvatarImage src={invite.team.avatar} />
                      <AvatarFallback>{invite.team.tag}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="font-display font-bold text-accent">[{invite.team.tag}]</span>
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{invite.team.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    от {invite.inviterNickname ?? 'капитана'} · до{' '}
                    {new Date(invite.expiresAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <Badge variant="outline">[{invite.team.tag}]</Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button
                  onClick={() => handleAccept(invite)}
                  disabled={loadingId === invite.id}
                >
                  {loadingId === invite.id ? '...' : 'Принять'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDecline(invite.id)}
                  disabled={loadingId === invite.id}
                >
                  Отклонить
                </Button>
                <Button variant="ghost" asChild>
                  <Link href={`/teams/${invite.teamId}`}>Профиль команды</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
