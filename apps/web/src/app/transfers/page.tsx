'use client';

import Link from 'next/link';
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
  Input,
  Label,
} from '@pitchzone/ui';

import { KitPreview } from '@/components/clubs/kit-preview';
import {
  createClubTransferAd,
  createPlayerTransferAd,
  getClubTransferAds,
  getPlayerTransferAds,
  getTransferPositions,
  closePlayerTransferAd,
  markTransfersVisited,
  type ClubTransferAd,
  type PlayerTransferAd,
  type TransferPosition,
} from '@/lib/api';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function TransfersPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState('players');
  const [positions, setPositions] = useState<TransferPosition[]>([]);
  const [playerAds, setPlayerAds] = useState<PlayerTransferAd[]>([]);
  const [clubAds, setClubAds] = useState<ClubTransferAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [position, setPosition] = useState('ST');
  const [availableDays, setAvailableDays] = useState<string[]>(['Сб', 'Вс']);
  const [aboutText, setAboutText] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [clubTeamId, setClubTeamId] = useState('');

  async function reload() {
    const [players, clubs, pos] = await Promise.all([
      getPlayerTransferAds(),
      getClubTransferAds(),
      getTransferPositions(),
    ]);
    setPlayerAds(players);
    setClubAds(clubs);
    setPositions(pos);
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    markTransfersVisited(session.accessToken).catch(() => undefined);
  }, [session?.accessToken]);

  async function handleCreatePlayerAd(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      await createPlayerTransferAd(session.accessToken, {
        position,
        availableDays,
        aboutText,
      });
      setAboutText('');
      setMessage('Объявление опубликовано');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClubAd(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !clubTeamId.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createClubTransferAd(session.accessToken, clubTeamId.trim(), {
        positionNeeded: position,
        requirementsText,
      });
      setRequirementsText('');
      setMessage('Вакансия опубликована');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  function toggleDay(day: string) {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/" className="text-muted-foreground hover:text-accent text-sm">
          ← На главную
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold">Трансферы</h1>
        <p className="text-muted-foreground mt-2">Игроки ищут клубы, клубы ищут игроков</p>
      </div>

      <div className="mb-6 flex gap-2">
        <Button
          type="button"
          variant={tab === 'players' ? 'default' : 'outline'}
          onClick={() => setTab('players')}
        >
          Игроки ищут команду
        </Button>
        <Button
          type="button"
          variant={tab === 'clubs' ? 'default' : 'outline'}
          onClick={() => setTab('clubs')}
        >
          Клубы ищут игроков
        </Button>
      </div>

      {tab === 'players' && (
        <div className="space-y-6">
          {session?.accessToken && (
            <Card>
              <CardHeader>
                <CardTitle>Опубликовать объявление</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePlayerAd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Амплуа</Label>
                    <select
                      className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      {positions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Игровые дни</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day) => (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant={availableDays.includes(day) ? 'default' : 'outline'}
                          onClick={() => toggleDay(day)}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>О себе</Label>
                    <Input
                      required
                      minLength={10}
                      value={aboutText}
                      onChange={(e) => setAboutText(e.target.value)}
                      placeholder="Опыт, стиль игры, цели..."
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Публикация...' : 'Опубликовать'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {playerAds.map((ad) => (
              <Card key={ad.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={ad.player.avatar ?? undefined} />
                      <AvatarFallback>
                        {ad.player.nickname.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        href={`/players/${ad.player.id}`}
                        className="hover:text-accent font-medium"
                      >
                        {ad.player.nickname}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary">{ad.positionLabel}</Badge>
                        <Badge variant="outline">Рейтинг {ad.player.rating}</Badge>
                        {ad.availableDays.map((day) => (
                          <Badge key={day} variant="outline">
                            {day}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">{ad.aboutText}</p>
                    </div>
                  </div>
                  {session?.user?.id === ad.player.id && session.accessToken && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await closePlayerTransferAd(session.accessToken!, ad.id);
                        await reload();
                      }}
                    >
                      Закрыть
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'clubs' && (
        <div className="space-y-6">
          {session?.accessToken && (
            <Card>
              <CardHeader>
                <CardTitle>Опубликовать вакансию клуба</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateClubAd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>ID клуба (teamId)</Label>
                    <Input
                      required
                      value={clubTeamId}
                      onChange={(e) => setClubTeamId(e.target.value)}
                      placeholder="cuid вашего клуба из URL /teams/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Нужное амплуа</Label>
                    <select
                      className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      {positions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Требования и условия</Label>
                    <Input
                      required
                      minLength={10}
                      value={requirementsText}
                      onChange={(e) => setRequirementsText(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Публикация...' : 'Опубликовать вакансию'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {clubAds.map((ad) => (
              <Card key={ad.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <KitPreview
                      templateId={ad.club.kitTemplateId ?? 'classic'}
                      primaryColor={ad.club.primaryColor}
                      secondaryColor={ad.club.secondaryColor}
                      accentColor={ad.club.accentColor}
                      className="h-16 w-20 shrink-0"
                    />
                    <div>
                      <Link href={`/teams/${ad.club.id}`} className="hover:text-accent font-medium">
                        [{ad.club.tag}] {ad.club.name}
                      </Link>
                      <div className="mt-1">
                        <Badge variant="secondary">{ad.positionLabel}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">{ad.requirementsText}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {message && <p className="text-accent text-sm">{message}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
