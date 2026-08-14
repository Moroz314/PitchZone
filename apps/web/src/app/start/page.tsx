'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@pitchzone/ui';

import {
  completeOnboardingProfile,
  getOnboardingProgress,
  getPickupMatches,
  getTransferPositions,
  leavePickupMatch,
  registerPickupMatch,
  type OnboardingProgress,
  type PickupMatchItem,
  type TransferPosition,
} from '@/lib/api';

const STEP_META = [
  { id: 'register', title: 'Регистрация', hint: 'Аккаунт PitchZone создан' },
  {
    id: 'profile',
    title: 'Профиль и геймертег',
    hint: 'EA FC ник, амплуа, страна и контакты',
  },
  {
    id: 'pickup',
    title: 'Сборные матчи',
    hint: 'Открытые матчи для знакомства с капитанами',
  },
  {
    id: 'transfers',
    title: 'Поиск команды',
    hint: 'Объявление в разделе Трансферы',
  },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StartPage() {
  const { data: session, status } = useSession();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [pickupMatches, setPickupMatches] = useState<PickupMatchItem[]>([]);
  const [positions, setPositions] = useState<TransferPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [profileWarnings, setProfileWarnings] = useState<string[]>([]);

  const [profileForm, setProfileForm] = useState({
    gamerTag: '',
    gamerTagConfirmed: false,
    primaryPosition: 'ST',
    country: '',
    countryCode: 'RU',
    city: '',
    vkUrl: '',
    telegramUrl: '',
    discordUsername: '',
  });

  const reload = useCallback(async () => {
    if (!session?.accessToken) return;
    const [p, matches, pos] = await Promise.all([
      getOnboardingProgress(session.accessToken),
      getPickupMatches(session.accessToken),
      getTransferPositions(),
    ]);
    setProgress(p);
    setPickupMatches(matches);
    setPositions(pos);
    if (p.profile) {
      setProfileForm((prev) => ({
        ...prev,
        gamerTag: p.profile?.gamerTag ?? prev.gamerTag,
        gamerTagConfirmed: p.profile?.gamerTagConfirmed ?? prev.gamerTagConfirmed,
        primaryPosition: p.profile?.primaryPosition ?? prev.primaryPosition,
        countryCode: p.profile?.countryCode ?? prev.countryCode,
        city: p.profile?.city ?? prev.city,
      }));
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [session?.accessToken, status, reload]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError('');
    setMessage('');
    setProfileWarnings([]);
    try {
      const result = await completeOnboardingProfile(session.accessToken, {
        ...profileForm,
        vkUrl: profileForm.vkUrl || undefined,
        telegramUrl: profileForm.telegramUrl || undefined,
        discordUsername: profileForm.discordUsername || undefined,
        country: profileForm.country || undefined,
      });
      setProfileWarnings(result.warnings);
      setProgress(result.progress);
      setMessage('Профиль сохранён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  }

  async function handlePickupAction(matchId: string, isRegistered: boolean) {
    if (!session?.accessToken) return;
    setError('');
    try {
      if (isRegistered) {
        await leavePickupMatch(session.accessToken, matchId);
        setMessage('Вы сняли регистрацию');
      } else {
        const updated = await registerPickupMatch(session.accessToken, matchId);
        setProgress(updated);
        setMessage('Вы записаны на сборный матч');
      }
      const matches = await getPickupMatches(session.accessToken);
      setPickupMatches(matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="text-muted-foreground mx-auto max-w-3xl px-4 py-16 text-center">
        Загрузка...
      </div>
    );
  }

  if (!session?.accessToken) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">С чего начать</h1>
        <p className="text-muted-foreground mt-4">
          Войдите или зарегистрируйтесь, чтобы пройти онбординг новичка.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/register">Регистрация</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Войти</Link>
          </Button>
        </div>
      </div>
    );
  }

  const steps = progress?.steps;
  const allComplete = progress?.allComplete;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/" className="text-muted-foreground hover:text-accent text-sm">
          ← На главную
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold">С чего начать</h1>
        <p className="text-muted-foreground mt-2">
          Четыре шага до первого официального матча: профиль, сборные игры и поиск команды.
        </p>
        {allComplete && (
          <Badge className="mt-4" variant="default">
            Онбординг завершён
          </Badge>
        )}
      </div>

      {(error || message) && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-destructive/50 text-destructive' : 'border-accent/30 text-accent'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="mb-8 space-y-3">
        {STEP_META.map((step, index) => {
          const key = step.id as keyof NonNullable<typeof steps>;
          const completed = steps?.[key]?.completed ?? step.id === 'register';
          const isCurrent = progress?.nextStep === step.id;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-4 rounded-lg border p-4 ${
                isCurrent ? 'border-accent/40 bg-accent/5' : 'border-border/50'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  completed ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {completed ? '✓' : index + 1}
              </div>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground text-sm">{step.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!steps?.profile.completed && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Шаг 2 — Профиль и геймертег</CardTitle>
            <CardDescription>
              Укажите ник из EA FC (режим Клубы). Он должен совпадать символ в символ — иначе на
              официальном матче возможны санкции.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gamerTag">Геймертег EA FC</Label>
                <Input
                  id="gamerTag"
                  placeholder="NeonStriker_11"
                  value={profileForm.gamerTag}
                  onChange={(e) => setProfileForm({ ...profileForm, gamerTag: e.target.value })}
                  required
                  minLength={3}
                  maxLength={16}
                />
                <p className="text-muted-foreground text-xs">
                  3–16 символов: латиница, цифры, пробел, _ и -
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryPosition">Основное амплуа</Label>
                <select
                  id="primaryPosition"
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={profileForm.primaryPosition}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, primaryPosition: e.target.value })
                  }
                >
                  {positions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Страна</Label>
                  <Input
                    id="country"
                    placeholder="Россия"
                    value={profileForm.country}
                    onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="countryCode">Код страны</Label>
                  <Input
                    id="countryCode"
                    placeholder="RU"
                    maxLength={2}
                    value={profileForm.countryCode}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        countryCode: e.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Город</Label>
                <Input
                  id="city"
                  placeholder="Москва"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="vkUrl">VK</Label>
                  <Input
                    id="vkUrl"
                    placeholder="https://vk.com/..."
                    value={profileForm.vkUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, vkUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramUrl">Telegram</Label>
                  <Input
                    id="telegramUrl"
                    placeholder="@username"
                    value={profileForm.telegramUrl}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, telegramUrl: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discordUsername">Discord</Label>
                  <Input
                    id="discordUsername"
                    placeholder="user#0000"
                    value={profileForm.discordUsername}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, discordUsername: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <input
                  id="gamerTagConfirmed"
                  type="checkbox"
                  className="border-input mt-1 h-4 w-4 rounded"
                  checked={profileForm.gamerTagConfirmed}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, gamerTagConfirmed: e.target.checked })
                  }
                />
                <Label htmlFor="gamerTagConfirmed" className="text-sm leading-snug">
                  Подтверждаю, что геймертег совпадает с ником в EA FC и готов нести ответственность
                  за несовпадение на официальных матчах.
                </Label>
              </div>

              {profileWarnings.length > 0 && (
                <ul className="list-inside list-disc text-xs text-amber-600">
                  {profileWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <Button type="submit" disabled={!profileForm.gamerTagConfirmed}>
                Сохранить профиль
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Шаг 3 — Сборные матчи</CardTitle>
          <CardDescription>
            Открытые scrimmage-матчи от модераторов. Запишитесь, чтобы капитаны увидели вас в игре.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!steps?.profile.completed && (
            <p className="text-muted-foreground text-sm">
              Сначала заполните профиль и подтвердите геймертег.
            </p>
          )}

          {pickupMatches.length === 0 ? (
            <p className="text-muted-foreground text-sm">Пока нет открытых сборных матчей.</p>
          ) : (
            pickupMatches.map((match) => (
              <div
                key={match.id}
                className="border-border/50 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{match.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(match.scheduledAt)}
                    {match.platform ? ` · ${match.platform}` : ''}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {match.registeredCount}/{match.maxPlayers} игроков
                    {match.status === 'FULL' && ' · Мест нет'}
                  </p>
                  {match.description && (
                    <p className="text-muted-foreground mt-1 text-sm">{match.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {match.chatUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={match.chatUrl} target="_blank" rel="noreferrer">
                        Чат
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={match.isRegistered ? 'outline' : 'default'}
                    disabled={!steps?.profile.completed}
                    onClick={() => handlePickupAction(match.id, match.isRegistered)}
                  >
                    {match.isRegistered ? 'Отменить запись' : 'Записаться'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Шаг 4 — Поиск команды</CardTitle>
          <CardDescription>
            Разместите объявление в Трансферах или откликнитесь на вакансию клуба.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {steps?.transfers.completed ? (
            <p className="text-accent text-sm">
              {steps.transfers.hasTeam
                ? 'Вы уже в составе команды.'
                : 'Раздел Трансферы посещён — объявление опубликовано или просмотрено.'}
            </p>
          ) : (
            <Button asChild>
              <Link href="/transfers">Перейти в Трансферы</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
