'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Calendar, Gamepad2, Lock, Trophy, Users } from 'lucide-react';

import { Badge, Button, Card, CardContent } from '@pitchzone/ui';

import { getTournamentBySlug, registerForTournament, type TournamentDetail } from '@/lib/api';
import {
  formatCountdown,
  formatCurrency,
  getStatusBadgeVariant,
  getStatusLabel,
  isRegistrationOpen,
} from '@/lib/mock-data';

interface TournamentHeroProps {
  tournament: TournamentDetail;
}

export function TournamentHero({ tournament: initialTournament }: TournamentHeroProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;

  const [tournament, setTournament] = useState(initialTournament);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [captainTeams, setCaptainTeams] = useState<
    { id: string; name: string; tag: string; role: string }[]
  >([]);

  const isPrivate = tournament.visibility === 'PRIVATE';
  const isTeamTournament = (tournament.teamSize ?? 1) > 1;
  const hasEntryFee = tournament.entryFee > 0;
  const access = tournament.access;
  const canRegister = access?.canRegister ?? !isPrivate;

  useEffect(() => {
    setTournament(initialTournament);
  }, [initialTournament]);

  useEffect(() => {
    if (!session?.accessToken) return;

    getTournamentBySlug(tournament.slug, {
      token: session.accessToken,
      invite: inviteToken,
    })
      .then(setTournament)
      .catch(() => undefined);
  }, [session?.accessToken, tournament.slug, inviteToken]);

  const registered = session?.user?.id
    ? tournament.participants.some(
        (p) =>
          p.paymentStatus === 'PAID' &&
          (p.userId === session.user.id ||
            (p.teamId && captainTeams.some((t) => t.id === p.teamId))),
      )
    : false;

  useEffect(() => {
    if (!session?.user?.id || !isTeamTournament) return;
    import('@/lib/api').then(({ getPlayer }) =>
      getPlayer(session.user.id)
        .then((profile) => {
          const teams = profile.teams.filter((t) => ['OWNER', 'CAPTAIN'].includes(t.role));
          setCaptainTeams(teams);
          if (teams.length === 1) setSelectedTeamId(teams[0].id);
        })
        .catch(() => setCaptainTeams([])),
    );
  }, [session?.user?.id, isTeamTournament]);

  async function handleRegister() {
    if (!session?.accessToken) {
      const callback = inviteToken
        ? `/tournaments/${tournament.slug}?invite=${inviteToken}`
        : `/tournaments/${tournament.slug}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }

    if (isTeamTournament && !selectedTeamId) {
      setError('Выберите команду для регистрации');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await registerForTournament(session.accessToken, tournament.id, {
        teamId: isTeamTournament ? selectedTeamId : undefined,
        inviteToken,
      });

      if (result.requiresPayment) {
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        setError('Не удалось создать платёжную сессию');
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  const registrationOpen = isRegistrationOpen(tournament.status);

  return (
    <section className="relative overflow-hidden border-b border-border/50">
      <div className={`absolute inset-0 bg-gradient-to-br ${tournament.bannerGradient}`} />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant={getStatusBadgeVariant(tournament.status)}>
                {getStatusLabel(tournament.status)}
              </Badge>
              {isPrivate && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Приватный
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">
              {tournament.title}
            </h1>
            {tournament.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{tournament.description}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Gamepad2 className="h-4 w-4" />
                {tournament.game}
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {tournament.format}
                {tournament.matchFormat ? ` · ${tournament.matchFormat.replace('BO', 'Bo')}` : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {tournament.participantCount}/{tournament.maxParticipants} участников
                {isTeamTournament ? ` · команды ${tournament.teamSize}v${tournament.teamSize}` : ''}
              </span>
              {registrationOpen && (
                <span className="flex items-center gap-1.5 text-accent">
                  <Calendar className="h-4 w-4" />
                  Старт через {formatCountdown(tournament.startsAt)}
                </span>
              )}
            </div>
            {tournament.escrow && tournament.escrow.totalHeld > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                В эскроу: {formatCurrency(tournament.escrow.totalHeld)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row lg:flex-col xl:flex-row">
            <Card className="prize-card min-w-[200px]">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Призовой фонд</p>
                <p className="font-display text-3xl font-bold text-gradient">
                  {formatCurrency(tournament.prizePool)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Взнос: {formatCurrency(tournament.entryFee)}
                </p>
              </CardContent>
            </Card>

            {registrationOpen && !registered && canRegister && (
              <div className="flex flex-col gap-2 self-start">
                {isTeamTournament && captainTeams.length > 0 && (
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                  >
                    <option value="">Выберите команду</option>
                    {captainTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.tag}] {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {isTeamTournament && captainTeams.length === 0 && session && (
                  <p className="text-xs text-muted-foreground">
                    Нужна команда.{' '}
                    <Link href="/teams/create" className="text-accent hover:underline">
                      Создать
                    </Link>
                  </p>
                )}
                <Button size="lg" onClick={handleRegister} disabled={loading}>
                  {loading
                    ? 'Обработка...'
                    : hasEntryFee
                      ? `Оплатить ${formatCurrency(tournament.entryFee)}`
                      : 'Зарегистрироваться'}
                </Button>
              </div>
            )}

            {registrationOpen && !registered && !canRegister && (
              <p className="max-w-xs self-start text-sm text-muted-foreground">
                {access?.reason ??
                  'Регистрация только по приглашению организатора или с invite-ссылкой'}
              </p>
            )}

            {registered && (
              <Badge variant="success" className="self-start px-4 py-2 text-sm">
                Вы зарегистрированы
              </Badge>
            )}

            {!session && registrationOpen && (
              <Button variant="outline" size="lg" className="self-start" asChild>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(
                    inviteToken
                      ? `/tournaments/${tournament.slug}?invite=${inviteToken}`
                      : `/tournaments/${tournament.slug}`,
                  )}`}
                >
                  Войти
                </Link>
              </Button>
            )}
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
