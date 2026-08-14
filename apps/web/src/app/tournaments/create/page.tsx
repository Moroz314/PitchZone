'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo, useState, useEffect } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, cn } from '@pitchzone/ui';

import {
  createTournament,
  getPlatformSettings,
  publishTournament,
  updateTournament,
  type CreateTournamentPayload,
  type PrizePlace,
  type TournamentListItem,
  type TournamentDetail,
} from '@/lib/api';
import { calculatePrizePoolPreview, formatCurrency } from '@/lib/mock-data';
import { canCreateTournaments } from '@/lib/can-create-tournaments';

const STEPS = ['Основное', 'Формат', 'Деньги', 'Правила', 'Публикация'];

const DEFAULT_DISTRIBUTION: PrizePlace[] = [
  { place: 1, percent: 50 },
  { place: 2, percent: 30 },
  { place: 3, percent: 20 },
];

export default function CreateTournamentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<TournamentListItem | TournamentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publishedStatus, setPublishedStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    bannerUrl: '',
    game: 'EA_FC',
    startsAt: '',
    registrationDeadline: '',
    format: 'SINGLE_ELIMINATION',
    maxParticipants: 8,
    minParticipants: 4,
    matchFormat: 'BO1',
    teamSize: 1,
    prizePoolType: 'FROM_FEES' as 'FROM_FEES' | 'FIXED_SPONSORED',
    entryFee: 500,
    fixedPrizePool: 50000,
    platformCommissionPercent: 10,
    prizeDistribution: DEFAULT_DISTRIBUTION,
    rulesText: '',
    proofRequirement: 'SCREENSHOT',
    visibility: 'PUBLIC',
  });

  const prizePreview = useMemo(
    () =>
      calculatePrizePoolPreview(
        form.prizePoolType,
        form.entryFee,
        form.maxParticipants,
        form.platformCommissionPercent,
        form.fixedPrizePool,
      ),
    [form],
  );

  useEffect(() => {
    getPlatformSettings()
      .then((settings) => {
        setForm((prev) => ({
          ...prev,
          platformCommissionPercent: settings.defaultPlatformCommissionPercent,
        }));
      })
      .catch(() => undefined);
  }, []);

  const distributionSum = form.prizeDistribution.reduce((s, p) => s + p.percent, 0);

  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/tournaments/create');
    return null;
  }

  if (status === 'authenticated' && !canCreateTournaments(session)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Нет доступа</h1>
        <p className="text-muted-foreground mt-3">
          Создавать турниры могут администраторы, модераторы и пользователи с выданным разрешением.
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href="/">К турнирам</Link>
        </Button>
      </div>
    );
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePlace(index: number, percent: number) {
    setForm((prev) => ({
      ...prev,
      prizeDistribution: prev.prizeDistribution.map((p, i) =>
        i === index ? { ...p, percent } : p,
      ),
    }));
  }

  function buildPayload(): CreateTournamentPayload {
    return {
      title: form.title,
      description: form.description || undefined,
      bannerUrl: form.bannerUrl || undefined,
      game: form.game,
      format: form.format,
      matchFormat: form.matchFormat,
      teamSize: form.teamSize,
      maxParticipants: form.maxParticipants,
      minParticipants: form.minParticipants,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      registrationDeadline: form.registrationDeadline
        ? new Date(form.registrationDeadline).toISOString()
        : undefined,
      prizePoolType: form.prizePoolType,
      entryFee: form.entryFee,
      fixedPrizePool: form.fixedPrizePool,
      platformCommissionPercent: form.platformCommissionPercent,
      prizeDistribution: form.prizeDistribution,
      rulesText: form.rulesText,
      proofRequirement: form.proofRequirement,
      visibility: form.visibility,
    };
  }

  async function saveDraft() {
    if (!session?.accessToken) return null;
    setLoading(true);
    setError('');
    try {
      const payload = buildPayload();
      const saved = draft
        ? await updateTournament(session.accessToken, draft.id, payload)
        : await createTournament(session.accessToken, payload);
      setDraft(saved);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function goToStep(targetStep: number) {
    if (targetStep === step) return;
    if (publishedStatus) return;

    if (targetStep > 0 && form.title.length < 3) {
      setError('Укажите название турнира (шаг «Основное»)');
      setStep(0);
      return;
    }

    setError('');

    if (form.title.length >= 3) {
      await saveDraft();
    }

    setStep(targetStep);
  }

  async function handleNext() {
    if (step === 0 && form.title.length < 3) {
      setError('Укажите название турнира');
      return;
    }
    const saved = await saveDraft();
    if (saved) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  async function handlePublish() {
    if (!session?.accessToken) return;
    if (Math.abs(distributionSum - 100) > 0.01) {
      setError('Сумма процентов призовых должна быть 100%');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const saved = (await saveDraft()) ?? draft;
      if (!saved) return;

      const published = await publishTournament(session.accessToken, saved.id);
      setPublishedStatus(published.status);
      setStep(STEPS.length - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка публикации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/" className="text-muted-foreground hover:text-accent text-sm">
        ← На главную
      </Link>
      <h1 className="font-display mt-4 text-3xl font-bold">Создание турнира</h1>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={loading || Boolean(publishedStatus)}
            onClick={() => goToStep(i)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
              'hover:ring-accent/40 focus-visible:ring-accent hover:ring-2 focus-visible:outline-none focus-visible:ring-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              i === step
                ? 'bg-accent text-accent-foreground'
                : i < step
                  ? 'bg-accent/20 text-accent hover:bg-accent/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>
            Шаг {step + 1}: {STEPS[step]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="EA FC Winter Cup 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="game">Игра</Label>
                <select
                  id="game"
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  value={form.game}
                  onChange={(e) => updateField('game', e.target.value)}
                >
                  <option value="EA_FC">EA FC 25</option>
                  <option value="EFOOTBALL">eFootball 2026</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Дата старта</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => updateField('startsAt', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Дедлайн регистрации</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={form.registrationDeadline}
                    onChange={(e) => updateField('registrationDeadline', e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Должен быть позже текущего момента и раньше даты старта. Если к дедлайну
                    наберётся меньше минимума команд, платный турнир отменится автоматически;
                    бесплатный останется открытым для организатора.
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Формат сетки</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  value={form.format}
                  onChange={(e) => updateField('format', e.target.value)}
                >
                  <option value="SINGLE_ELIMINATION">Single Elimination</option>
                  <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                  <option value="ROUND_ROBIN">Round Robin</option>
                  <option value="SWISS">Swiss System</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Участников (макс.)</Label>
                  <select
                    className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                    value={form.maxParticipants}
                    onChange={(e) => updateField('maxParticipants', Number(e.target.value))}
                  >
                    {[4, 8, 16, 32, 64].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Формат матча</Label>
                  <select
                    className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                    value={form.matchFormat}
                    onChange={(e) => updateField('matchFormat', e.target.value)}
                  >
                    <option value="BO1">Bo1</option>
                    <option value="BO3">Bo3</option>
                    <option value="BO5">Bo5</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Размер команды</Label>
                  <Input
                    type="number"
                    min={1}
                    max={11}
                    value={form.teamSize}
                    onChange={(e) => updateField('teamSize', Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Тип призового фонда</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  value={form.prizePoolType}
                  onChange={(e) =>
                    updateField('prizePoolType', e.target.value as 'FROM_FEES' | 'FIXED_SPONSORED')
                  }
                >
                  <option value="FROM_FEES">Из взносов участников</option>
                  <option value="FIXED_SPONSORED">Фиксированный (спонсорский)</option>
                </select>
              </div>
              {form.prizePoolType === 'FROM_FEES' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Взнос (₽)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.entryFee}
                      onChange={(e) => updateField('entryFee', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Комиссия платформы (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={form.platformCommissionPercent}
                      onChange={(e) =>
                        updateField('platformCommissionPercent', Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Фиксированный приз (₽)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.fixedPrizePool}
                    onChange={(e) => updateField('fixedPrizePool', Number(e.target.value))}
                  />
                </div>
              )}
              <div className="border-accent/30 bg-accent/5 rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Расчётный призовой фонд</p>
                <p className="font-display text-accent text-2xl font-bold">
                  {formatCurrency(prizePreview)}
                </p>
              </div>
              <div className="space-y-3">
                <Label>Распределение по местам (сумма = 100%)</Label>
                {form.prizeDistribution.map((place, i) => (
                  <div key={place.place} className="flex items-center gap-3">
                    <span className="w-20 text-sm">{place.place} место</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={place.percent}
                      onChange={(e) => updatePlace(i, Number(e.target.value))}
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                ))}
                <p
                  className={`text-sm ${Math.abs(distributionSum - 100) < 0.01 ? 'text-accent' : 'text-destructive'}`}
                >
                  Итого: {distributionSum}%
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="rules">Регламент *</Label>
                <textarea
                  id="rules"
                  className="border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
                  value={form.rulesText}
                  onChange={(e) => updateField('rulesText', e.target.value)}
                  placeholder="Правила турнира, дисквалификация за читы..."
                />
              </div>
              <div className="space-y-2">
                <Label>Требование к пруфу</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  value={form.proofRequirement}
                  onChange={(e) => updateField('proofRequirement', e.target.value)}
                >
                  <option value="SCREENSHOT">Скриншот</option>
                  <option value="VIDEO">Видео</option>
                  <option value="BOTH">Скриншот и видео</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Видимость</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  value={form.visibility}
                  onChange={(e) => updateField('visibility', e.target.value)}
                >
                  <option value="PUBLIC">Публичный</option>
                  <option value="PRIVATE">Приватный (по ссылке)</option>
                </select>
                {form.visibility === 'PRIVATE' && (
                  <p className="text-muted-foreground text-xs">
                    Приватный турнир не попадает в общий листинг. Для обычных пользователей
                    регистрация открывается сразу без модерации; пригласите соперников по нику или
                    тегу команды после публикации.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {publishedStatus ? (
                <>
                  <p className="text-accent">
                    Турнир опубликован! Статус:{' '}
                    {publishedStatus === 'registration_open'
                      ? 'Регистрация открыта'
                      : form.visibility === 'PRIVATE'
                        ? 'Регистрация открыта (приватный)'
                        : 'На модерации'}
                  </p>
                  <Button asChild>
                    <Link href={`/tournaments/${draft?.slug}`}>Перейти к турниру</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    Проверьте данные и опубликуйте турнир. Верифицированные организаторы и приватные
                    турниры получают статус «Регистрация открыта» сразу; публичные турниры от
                    обычных пользователей — «На модерации».
                  </p>
                  <ul className="space-y-1 text-sm">
                    <li>Название: {form.title}</li>
                    <li>Участников: до {form.maxParticipants}</li>
                    <li>Видимость: {form.visibility === 'PRIVATE' ? 'Приватный' : 'Публичный'}</li>
                    <li>Призовой фонд: {formatCurrency(prizePreview)}</li>
                  </ul>
                  <Button onClick={handlePublish} disabled={loading}>
                    {loading ? 'Публикация...' : 'Опубликовать турнир'}
                  </Button>
                </>
              )}
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {step < 4 && !publishedStatus && (
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                disabled={step === 0 || loading}
                onClick={() => goToStep(step - 1)}
              >
                Назад
              </Button>
              <Button onClick={handleNext} disabled={loading}>
                {loading ? 'Сохранение...' : 'Далее'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
