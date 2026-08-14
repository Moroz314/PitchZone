'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Badge, Button, Input } from '@pitchzone/ui';

import {
  createTournamentInvite,
  deleteTournamentInvite,
  type TournamentDetail,
  type TournamentInvite,
} from '@/lib/api';

interface PrivateTournamentInvitesProps {
  tournament: TournamentDetail;
}

export function PrivateTournamentInvites({ tournament }: PrivateTournamentInvitesProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  if (
    tournament.visibility !== 'PRIVATE' ||
    !session?.user?.id ||
    session.user.id !== tournament.organizerId
  ) {
    return null;
  }

  const invites = tournament.invites ?? [];
  const isTeamTournament = (tournament.teamSize ?? 1) > 1;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;

    setLoading(true);
    setMessage('');
    try {
      await createTournamentInvite(session.accessToken, tournament.id, {
        nickname: isTeamTournament ? undefined : nickname.trim() || undefined,
        teamTag: isTeamTournament ? teamTag.trim().toUpperCase() || undefined : undefined,
      });
      setNickname('');
      setTeamTag('');
      setMessage('Приглашение отправлено');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось отправить приглашение');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(inviteId: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      await deleteTournamentInvite(session.accessToken, tournament.id, inviteId);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось удалить приглашение');
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteLink() {
    if (!tournament.inviteLink) return;
    await navigator.clipboard.writeText(tournament.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-6 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Приватный турнир</p>
          <p className="text-sm text-muted-foreground">
            Не показывается в общем листинге. Комиссия платформы ({tournament.platformCommissionPercent}%)
            удерживается из призового фонда как у публичных турниров.
          </p>
        </div>
        <Badge variant="secondary">PRIVATE</Badge>
      </div>

      {tournament.inviteLink && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input readOnly value={tournament.inviteLink} className="max-w-xl font-mono text-xs" />
          <Button type="button" size="sm" variant="outline" onClick={copyInviteLink}>
            {copied ? 'Скопировано' : 'Копировать ссылку'}
          </Button>
        </div>
      )}

      <form onSubmit={handleInvite} className="mt-4 flex flex-wrap items-end gap-2">
        {isTeamTournament ? (
          <div>
            <label htmlFor="invite-team-tag" className="text-xs font-medium">
              Тег команды
            </label>
            <Input
              id="invite-team-tag"
              value={teamTag}
              onChange={(e) => setTeamTag(e.target.value)}
              placeholder="NEON"
              className="mt-1 w-40 uppercase"
              disabled={loading}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="invite-nickname" className="text-xs font-medium">
              Ник игрока
            </label>
            <Input
              id="invite-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="GoalHunter"
              className="mt-1 w-48"
              disabled={loading}
            />
          </div>
        )}
        <Button type="submit" size="sm" disabled={loading}>
          Пригласить
        </Button>
      </form>

      {invites.length > 0 && (
        <ul className="mt-4 space-y-2">
          {invites.map((invite: TournamentInvite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2 text-sm"
            >
              <span>
                {invite.team
                  ? `[${invite.team.tag}] ${invite.team.name}`
                  : invite.user?.nickname ?? '—'}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={invite.status === 'ACCEPTED' ? 'success' : 'secondary'}>
                  {invite.status === 'ACCEPTED' ? 'Принято' : 'Ожидает'}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => handleRemove(invite.id)}
                >
                  Удалить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    </div>
  );
}
