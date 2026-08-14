'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@pitchzone/ui';

import {
  getCurrentSeason,
  getEaClubLink,
  getTeamContracts,
  offerContract,
  registerTeamForSeason,
  removeTeamMember,
  updateEaClubLink,
  type ContractItem,
  type EaClubPlatform,
  type SeasonSummary,
  type TeamProfile,
} from '@/lib/api';

interface ClubManagementProps {
  team: TeamProfile;
}

export function ClubManagement({ team }: ClubManagementProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [durationMonths, setDurationMonths] = useState(1);
  const [buyoutFee, setBuyoutFee] = useState(0);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [openSeason, setOpenSeason] = useState<SeasonSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [eaClubId, setEaClubId] = useState('');
  const [eaPlatform, setEaPlatform] = useState<EaClubPlatform>('PC');
  const [eaLinkSaved, setEaLinkSaved] = useState(false);

  const myMembership = team.members.find((m) => m.id === session?.user?.id);
  const canManage = myMembership && ['OWNER', 'CAPTAIN'].includes(myMembership.role);
  const isMember = Boolean(myMembership);
  const isOwner = myMembership?.role === 'OWNER';

  useEffect(() => {
    if (!session?.accessToken || !canManage) return;
    getTeamContracts(session.accessToken, team.id)
      .then(setContracts)
      .catch(() => setContracts([]));
  }, [session?.accessToken, team.id, canManage]);

  useEffect(() => {
    getCurrentSeason()
      .then((season) => {
        if (season?.status === 'REGISTRATION') setOpenSeason(season);
      })
      .catch(() => setOpenSeason(null));
  }, []);

  useEffect(() => {
    getEaClubLink(team.id)
      .then((link) => {
        if (link) {
          setEaClubId(link.eaClubId);
          setEaPlatform(link.platform);
          setEaLinkSaved(true);
        }
      })
      .catch(() => undefined);
  }, [team.id]);

  if (!session?.user) return null;

  async function handleSaveEaLink(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !eaClubId.trim()) return;
    setLoading(true);
    setError('');
    try {
      await updateEaClubLink(session.accessToken, team.id, {
        eaClubId: eaClubId.trim(),
        platform: eaPlatform,
      });
      setEaLinkSaved(true);
      setMessage('EA Club ID сохранён — воркер будет опрашивать матчи автоматически');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSeason() {
    if (!session?.accessToken || !openSeason) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await registerTeamForSeason(session.accessToken, openSeason.id, team.id);
      setMessage(`Команда заявлена на сезон «${openSeason.name}»`);
      setOpenSeason(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !nickname.trim()) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await offerContract(session.accessToken, team.id, {
        nickname: nickname.trim(),
        durationMonths,
        buyoutFee,
      });
      setNickname('');
      setMessage(`Контракт предложен игроку ${nickname}`);
      const items = await getTeamContracts(session.accessToken, team.id);
      setContracts(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      await removeTeamMember(session.accessToken, team.id, session.user!.id!);
      router.push('/players/' + session.user!.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {canManage && openSeason && (
        <Card className="border-accent/30 bg-accent/5 mt-8">
          <CardHeader>
            <CardTitle>Регистрация на сезон</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Открыта заявка на <strong>{openSeason.name}</strong>
              {openSeason.hasDivisions
                ? ' — дивизион будет назначен автоматически'
                : ' — общая группа без дивизионов'}
            </p>
            <Button disabled={loading} onClick={handleRegisterSeason}>
              {loading ? 'Отправка...' : 'Заявить команду на сезон'}
            </Button>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="border-accent/20 mt-8">
          <CardHeader>
            <CardTitle>EA Pro Clubs — привязка клуба</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Укажите реальный EA Club ID и платформу. Воркер PitchZone опрашивает proclubs.ea.com
              каждые 20 минут и подтягивает статистику в официальные матчи сезона.
            </p>
            <form onSubmit={handleSaveEaLink} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eaClubId">EA Club ID</Label>
                <Input
                  id="eaClubId"
                  placeholder="123456789"
                  value={eaClubId}
                  onChange={(e) => setEaClubId(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eaPlatform">Платформа</Label>
                <select
                  id="eaPlatform"
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={eaPlatform}
                  onChange={(e) => setEaPlatform(e.target.value as EaClubPlatform)}
                >
                  <option value="PC">PC</option>
                  <option value="PS">PlayStation</option>
                  <option value="XBOX">Xbox</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="sm:col-span-2">
                {loading
                  ? 'Сохранение...'
                  : eaLinkSaved
                    ? 'Обновить привязку'
                    : 'Сохранить EA Club ID'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Мой клуб — контракты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleOffer} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contract-nickname">Предложить контракт игроку</Label>
                <Input
                  id="contract-nickname"
                  placeholder="Никнейм игрока"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Срок (мес., макс. 3)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={3}
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyout">Отступные (₽)</Label>
                <Input
                  id="buyout"
                  type="number"
                  min={0}
                  value={buyoutFee}
                  onChange={(e) => setBuyoutFee(Number(e.target.value))}
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !nickname.trim()}
                className="sm:col-span-2"
              >
                {loading ? 'Отправка...' : 'Отправить предложение'}
              </Button>
            </form>

            {contracts.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Контракты клуба</p>
                <ul className="space-y-2 text-sm">
                  {contracts.map((c) => (
                    <li
                      key={c.id}
                      className="border-border/50 flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <span>{c.playerNickname ?? c.userId}</span>
                      <span className="text-muted-foreground">
                        {c.status} · {c.durationMonths} мес.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {message && <p className="text-accent text-sm">{message}</p>}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </CardContent>
        </Card>
      )}

      {isMember && !isOwner && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Покинуть клуб</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              При активном контракте уход возможен только с согласия капитана или после выплаты
              отступных.
            </p>
            <Button variant="outline" disabled={loading} onClick={handleLeave}>
              Покинуть клуб
            </Button>
            {error && !canManage && <p className="text-destructive mt-2 text-sm">{error}</p>}
          </CardContent>
        </Card>
      )}
    </>
  );
}
