'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Button, Input, Label } from '@pitchzone/ui';

import {
  cancelTournament,
  deleteTournament,
  generateBracket,
  publishTournament,
  reopenTournament,
  startTournament,
  type TournamentDetail,
} from '@/lib/api';

interface OrganizerControlsProps {
  tournament: TournamentDetail;
}

export function OrganizerControls({ tournament }: OrganizerControlsProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  if (!session?.user?.id || session.user.id !== tournament.organizerId) {
    return null;
  }

  async function runAction(action: string, fn: () => Promise<unknown>) {
    if (!session?.accessToken) return;
    setLoading(action);
    setMessage('');
    try {
      await fn();
      setMessage('Готово');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading('');
    }
  }

  async function handleDelete() {
    if (!session?.accessToken) return;
    const confirmed = window.confirm(
      'Удалить турнир безвозвратно? Все данные (участники, сетка, настройки) будут стёрты. Оплатившим участникам вернутся взносы.',
    );
    if (!confirmed) return;

    setLoading('delete');
    setMessage('');
    try {
      await deleteTournament(session.accessToken, tournament.id);
      router.push('/tournaments');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
      setLoading('');
    }
  }

  const canDelete = !['live', 'finished'].includes(tournament.status);

  return (
    <div className="mb-6 space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">Панель организатора</p>

      {tournament.status === 'cancelled' && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">Турнир отменён</p>
          <p className="mt-1 text-muted-foreground">
            Обычно это происходит, если к дедлайну регистрации набралось меньше минимального числа
            команд (для платных турниров — с автоматическим возвратом взносов).
          </p>
          {(tournament.entryFee ?? 0) === 0 && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="reopen-deadline" className="text-xs">
                  Новый дедлайн регистрации
                </Label>
                <Input
                  id="reopen-deadline"
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button
                size="sm"
                disabled={!!loading || !newDeadline}
                onClick={() =>
                  runAction('reopen', () =>
                    reopenTournament(
                      session!.accessToken!,
                      tournament.id,
                      new Date(newDeadline).toISOString(),
                    ),
                  )
                }
              >
                {loading === 'reopen' ? '...' : 'Переоткрыть регистрацию'}
              </Button>
            </div>
          )}
        </div>
      )}

      {tournament.status === 'registration_closed' && tournament.matches.length === 0 && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
          <p className="font-medium text-yellow-600 dark:text-yellow-400">Регистрация закрыта</p>
          <p className="mt-1 text-muted-foreground">
            Сетка ещё не создана. Укажите новый дедлайн в будущем и переоткройте регистрацию — или
            сохраните дедлайн в блоке «Редактировать турнир».
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="reopen-closed-deadline" className="text-xs">
                Новый дедлайн регистрации
              </Label>
              <Input
                id="reopen-closed-deadline"
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              disabled={!!loading || !newDeadline}
              onClick={() =>
                runAction('reopen', () =>
                  reopenTournament(
                    session!.accessToken!,
                    tournament.id,
                    new Date(newDeadline).toISOString(),
                  ),
                )
              }
            >
              {loading === 'reopen' ? '...' : 'Открыть регистрацию снова'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {tournament.status === 'draft' && (
          <Button
            size="sm"
            disabled={!!loading}
            onClick={() =>
              runAction('publish', () => publishTournament(session!.accessToken!, tournament.id))
            }
          >
            {loading === 'publish' ? '...' : 'Опубликовать'}
          </Button>
        )}

        {['registration_closed', 'bracket_generated'].includes(tournament.status) && (
          <Button
            size="sm"
            disabled={!!loading}
            onClick={() =>
              runAction('bracket', () => generateBracket(session!.accessToken!, tournament.id))
            }
          >
            {loading === 'bracket' ? '...' : 'Пересобрать сетку'}
          </Button>
        )}

        {tournament.status === 'registration_open' && (
          <span className="text-xs text-muted-foreground">
            Сетка создаётся автоматически после закрытия регистрации
          </span>
        )}

        {tournament.status === 'bracket_generated' && (
          <Button
            size="sm"
            disabled={!!loading}
            onClick={() =>
              runAction('start', () => startTournament(session!.accessToken!, tournament.id))
            }
          >
            {loading === 'start' ? '...' : 'Начать турнир'}
          </Button>
        )}

        {!['live', 'finished', 'cancelled'].includes(tournament.status) && (
          <Button
            size="sm"
            variant="destructive"
            disabled={!!loading}
            onClick={() =>
              runAction('cancel', () => cancelTournament(session!.accessToken!, tournament.id))
            }
          >
            {loading === 'cancel' ? '...' : 'Отменить'}
          </Button>
        )}

        {canDelete && (
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            disabled={!!loading}
            onClick={handleDelete}
          >
            {loading === 'delete' ? '...' : 'Удалить турнир'}
          </Button>
        )}

        {message && <span className="text-sm text-accent">{message}</span>}
      </div>
    </div>
  );
}
