'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  cn,
} from '@pitchzone/ui';

import {
  updateTournament,
  type CreateTournamentPayload,
  type PrizePlace,
  type TournamentDetail,
} from '@/lib/api';
import { calculatePrizePoolPreview, formatCurrency } from '@/lib/mock-data';

const DEFAULT_DISTRIBUTION: PrizePlace[] = [
  { place: 1, percent: 50 },
  { place: 2, percent: 30 },
  { place: 3, percent: 20 },
];

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tournamentToForm(t: TournamentDetail) {
  const distribution = (t.prizeDistribution as PrizePlace[] | undefined) ?? DEFAULT_DISTRIBUTION;
  return {
    title: t.title,
    description: t.description ?? '',
    bannerUrl: t.bannerUrl ?? '',
    game: t.gameKey ?? 'EA_FC',
    format: t.formatKey ?? 'SINGLE_ELIMINATION',
    matchFormat: t.matchFormat ?? 'BO1',
    teamSize: t.teamSize ?? 1,
    maxParticipants: t.maxParticipants,
    minParticipants: t.minParticipants ?? 2,
    startsAt: toDatetimeLocal(t.startsAt),
    registrationDeadline: toDatetimeLocal(t.registrationDeadline),
    prizePoolType: (t.prizePoolType ?? 'FROM_FEES') as 'FROM_FEES' | 'FIXED_SPONSORED',
    entryFee: t.entryFee ?? 0,
    fixedPrizePool: t.fixedPrizePool ?? 50000,
    platformCommissionPercent: t.platformCommissionPercent ?? 10,
    prizeDistribution: distribution.length > 0 ? distribution : DEFAULT_DISTRIBUTION,
    rulesText: t.rulesText ?? '',
    proofRequirement: t.proofRequirement ?? 'SCREENSHOT',
    visibility: t.visibility ?? 'PUBLIC',
    bannerGradient: t.bannerGradient ?? 'from-accent/20 via-accent-cyan/10 to-transparent',
  };
}

interface OrganizerEditPanelProps {
  tournament: TournamentDetail;
}

export function OrganizerEditPanel({ tournament }: OrganizerEditPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(() => tournamentToForm(tournament));

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

  const isOrganizer = session?.user?.id === tournament.organizerId;
  const canEdit = isOrganizer && tournament.status !== 'finished';

  if (!canEdit) {
    return null;
  }

  const hasBracket = tournament.matches.length > 0;
  const hasPaid = tournament.participants.some((p) => p.paymentStatus === 'PAID');
  const structuralLocked = hasBracket || ['bracket_generated', 'live'].includes(tournament.status);
  const financialLocked = hasPaid || tournament.status === 'live';

  const distributionSum = form.prizeDistribution.reduce((s, p) => s + p.percent, 0);

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
      bannerGradient: form.bannerGradient,
    };
  }

  async function handleSave() {
    if (!session?.accessToken) return;
    if (form.title.length < 3) {
      setError('Название — минимум 3 символа');
      return;
    }
    if (Math.abs(distributionSum - 100) > 0.01) {
      setError('Сумма процентов призовых должна быть 100%');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateTournament(session.accessToken, tournament.id, buildPayload());
      setSuccess('Изменения сохранены');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(tournamentToForm(tournament));
    setError('');
    setSuccess('');
  }

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Card className="mb-6 border-border/50">
      <CardHeader className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Редактировать турнир</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Свернуть' : 'Развернуть'}
          </Button>
        </div>
        <p className="text-sm font-normal text-muted-foreground">
          Измените настройки, которые задавали при создании. Некоторые поля блокируются после
          регистрации участников или генерации сетки.
        </p>
      </CardHeader>

      {open && (
        <CardContent className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Основное
            </h3>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Название</Label>
              <Input
                id="edit-title"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Описание</Label>
              <textarea
                id="edit-desc"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-banner">URL баннера</Label>
              <Input
                id="edit-banner"
                value={form.bannerUrl}
                onChange={(e) => updateField('bannerUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-starts">Дата старта</Label>
                <Input
                  id="edit-starts"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => updateField('startsAt', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Дедлайн регистрации</Label>
                <Input
                  id="edit-deadline"
                  type="datetime-local"
                  value={form.registrationDeadline}
                  onChange={(e) => updateField('registrationDeadline', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Игра</Label>
              <select
                className={selectClass}
                value={form.game}
                onChange={(e) => updateField('game', e.target.value)}
              >
                <option value="EA_FC">EA FC 25</option>
                <option value="EFOOTBALL">eFootball 2026</option>
                <option value="OTHER">Другое</option>
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Формат
            </h3>
            {structuralLocked && (
              <p className="text-xs text-yellow-500/90">
                Формат сетки и размер команды заблокированы — сетка уже создана.
              </p>
            )}
            <div className="space-y-2">
              <Label>Формат сетки</Label>
              <select
                className={selectClass}
                value={form.format}
                disabled={structuralLocked}
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
                <Label>Макс. участников</Label>
                <select
                  className={selectClass}
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
                <Label>Мин. участников</Label>
                <Input
                  type="number"
                  min={2}
                  max={form.maxParticipants}
                  value={form.minParticipants}
                  onChange={(e) => updateField('minParticipants', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Размер команды</Label>
                <Input
                  type="number"
                  min={1}
                  max={11}
                  disabled={structuralLocked}
                  value={form.teamSize}
                  onChange={(e) => updateField('teamSize', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Формат матча</Label>
              <select
                className={selectClass}
                value={form.matchFormat}
                disabled={structuralLocked}
                onChange={(e) => updateField('matchFormat', e.target.value)}
              >
                <option value="BO1">Bo1</option>
                <option value="BO3">Bo3</option>
                <option value="BO5">Bo5</option>
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Призовые
            </h3>
            {financialLocked && (
              <p className="text-xs text-yellow-500/90">
                Финансовые настройки заблокированы — есть оплатившие участники.
              </p>
            )}
            <div className="space-y-2">
              <Label>Тип призового фонда</Label>
              <select
                className={selectClass}
                disabled={financialLocked}
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
                    disabled={financialLocked}
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
                    disabled={financialLocked}
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
                  disabled={financialLocked}
                  value={form.fixedPrizePool}
                  onChange={(e) => updateField('fixedPrizePool', Number(e.target.value))}
                />
              </div>
            )}
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm text-muted-foreground">Расчётный призовой фонд</p>
              <p className="font-display text-2xl font-bold text-accent">
                {formatCurrency(prizePreview)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Распределение призов (%)</Label>
              {form.prizeDistribution.map((place, i) => (
                <div key={place.place} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-muted-foreground">{place.place} место</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    disabled={financialLocked}
                    value={place.percent}
                    onChange={(e) => updatePlace(i, Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              ))}
              <p
                className={cn(
                  'text-xs',
                  Math.abs(distributionSum - 100) > 0.01 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                Сумма: {distributionSum}% (нужно 100%)
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Правила и доступ
            </h3>
            <div className="space-y-2">
              <Label htmlFor="edit-rules">Регламент</Label>
              <textarea
                id="edit-rules"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.rulesText}
                onChange={(e) => updateField('rulesText', e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Требование пруфа</Label>
                <select
                  className={selectClass}
                  value={form.proofRequirement}
                  onChange={(e) => updateField('proofRequirement', e.target.value)}
                >
                  <option value="SCREENSHOT">Скриншот</option>
                  <option value="VIDEO">Видео</option>
                  <option value="NONE">Не требуется</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Видимость</Label>
                <select
                  className={selectClass}
                  value={form.visibility}
                  onChange={(e) => updateField('visibility', e.target.value)}
                >
                  <option value="PUBLIC">Публичный</option>
                  <option value="PRIVATE">Приватный</option>
                </select>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-accent">{success}</p>}

          <div className="flex flex-wrap gap-3">
            <Button disabled={loading} onClick={handleSave}>
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
            <Button type="button" variant="outline" disabled={loading} onClick={handleReset}>
              Сбросить
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
