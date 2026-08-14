'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import { FutCard } from '@/components/players/fut-card';
import {
  getPlayerProfileAwards,
  getPlayerProfileStatistics,
  getPlayerProfileTransfers,
  pinPlayerAward,
  type PlayerAwardItem,
  type PlayerProfileOverview,
  type PlayerProfileStatistics,
  type PlayerTransferEntry,
} from '@/lib/api';

const TABS = [
  { id: 'profile', label: 'Профиль' },
  { id: 'stats', label: 'Статистика' },
  { id: 'transfers', label: 'Переходы' },
  { id: 'awards', label: 'Трофеи' },
] as const;

const STAT_TABS = [
  { id: 'season', label: 'Сезонная' },
  { id: 'tournament', label: 'По турнирам' },
  { id: 'club', label: 'Клубная' },
  { id: 'match', label: 'В матчах' },
] as const;

const AWARD_CATEGORIES = [
  { id: '', label: 'Все награды' },
  { id: 'TEAM', label: 'Командные' },
  { id: 'INDIVIDUAL', label: 'Индивидуальные' },
  { id: 'MANAGEMENT', label: 'Руководство' },
  { id: 'WEEKLY_CUP', label: 'Еженедельный кубок' },
  { id: 'SYMBOLIC_TEAM', label: 'TOTW/TOTS' },
  { id: 'SPECIAL', label: 'Особые' },
] as const;

const STAT_CATEGORIES = [
  { id: 'summary', label: 'Общая сводка' },
  { id: 'shooting', label: 'Удары' },
  { id: 'passing', label: 'Пасы' },
  { id: 'defense', label: 'Отбор' },
  { id: 'goalkeeper', label: 'Вратарские' },
] as const;

interface PlayerProfileTabsProps {
  overview: PlayerProfileOverview;
}

export function PlayerProfileTabs({ overview }: PlayerProfileTabsProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('profile');
  const [statSubTab, setStatSubTab] = useState<(typeof STAT_TABS)[number]['id']>('season');
  const [statCategory, setStatCategory] = useState('summary');
  const [positionFilter, setPositionFilter] = useState('');
  const [statsData, setStatsData] = useState<PlayerProfileStatistics | null>(null);
  const [transfers, setTransfers] = useState<PlayerTransferEntry[]>([]);
  const [awards, setAwards] = useState<PlayerAwardItem[]>([]);
  const [awardCategory, setAwardCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const userId = overview.player.id;
  const isOwnProfile = session?.user?.id === userId;

  useEffect(() => {
    if (activeTab !== 'stats') return;
    setLoading(true);
    getPlayerProfileStatistics(userId, {
      tab: statSubTab,
      position: positionFilter || undefined,
      category: statCategory,
    })
      .then(setStatsData)
      .finally(() => setLoading(false));
  }, [activeTab, statSubTab, statCategory, positionFilter, userId]);

  useEffect(() => {
    if (activeTab !== 'transfers') return;
    getPlayerProfileTransfers(userId).then(setTransfers);
  }, [activeTab, userId]);

  useEffect(() => {
    if (activeTab !== 'awards') return;
    getPlayerProfileAwards(userId, awardCategory || undefined).then(setAwards);
  }, [activeTab, awardCategory, userId]);

  async function togglePin(awardId: string, pinned: boolean) {
    if (!session?.accessToken) return;
    await pinPlayerAward(session.accessToken, awardId, pinned);
    const refreshed = await getPlayerProfileAwards(userId, awardCategory || undefined);
    setAwards(refreshed);
  }

  const career = overview.career;

  return (
    <div>
      <div className="border-border/50 mb-8 flex flex-wrap gap-2 border-b pb-4">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <FutCard card={overview.card} player={overview.player} />

            <div className="space-y-6">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Личные данные</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Регистрация </span>
                    {overview.player.joinedAt}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Геймертег </span>
                    {overview.player.gamerTag ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">ФИО </span>
                    {overview.player.fullName ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Страна </span>
                    {overview.player.country ?? '—'} ({overview.player.countryCode ?? '—'})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Город </span>
                    {overview.player.city ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Амплуа </span>
                    {overview.player.primaryPositionLabel ?? '—'}
                  </div>
                  <div className="flex flex-wrap gap-3 sm:col-span-2">
                    {overview.player.socialLinks.vk && (
                      <a
                        href={overview.player.socialLinks.vk}
                        className="text-accent hover:underline"
                      >
                        VK
                      </a>
                    )}
                    {overview.player.socialLinks.telegram && (
                      <span>Telegram: {overview.player.socialLinks.telegram}</span>
                    )}
                    {overview.player.socialLinks.discord && (
                      <span>Discord: {overview.player.socialLinks.discord}</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {overview.contract && (
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Условия контракта</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>
                      Клуб:{' '}
                      <Link href={`/teams/${overview.contract.team.id}`} className="text-accent">
                        [{overview.contract.team.tag}] {overview.contract.team.name}
                      </Link>
                    </p>
                    <p className="mt-1">Статус: {overview.contract.role}</p>
                    <p className="mt-1">
                      Окончание:{' '}
                      {overview.contract.isIndefinite
                        ? 'бессрочно'
                        : overview.contract.endDate?.split('T')[0]}
                    </p>
                    {overview.contract.buyoutFee != null && (
                      <p className="mt-1">Отступные: {overview.contract.buyoutFee} ₽</p>
                    )}
                    {overview.contract.contractId && (
                      <Button variant="link" className="mt-2 h-auto p-0" asChild>
                        <Link href="/contracts">Подробная информация →</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Избранные награды</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.pinnedAwards.length === 0 ? (
                <p className="text-muted-foreground text-sm">Нет избранных наград</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {overview.pinnedAwards.map((a) => (
                    <Badge key={a.id} variant="outline" className="gap-1 px-3 py-2">
                      <span>{a.iconEmoji}</span> {a.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {career && (
            <Card className="glass">
              <CardHeader>
                <CardTitle>Общая статистика</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      label: 'Матчей',
                      value: career.totalMatches,
                      rank: career.ranks.totalMatches,
                    },
                    { label: 'XP', value: career.totalXp, rank: career.ranks.totalXp },
                    {
                      label: 'Ср. рейтинг',
                      value: career.avgMatchRating,
                      rank: career.ranks.avgRating,
                    },
                    { label: 'Голы', value: career.goals, rank: career.ranks.goals },
                    { label: 'Передачи', value: career.assists, rank: career.ranks.assists },
                    {
                      label: 'Точность паса',
                      value: `${career.passAccuracyPercent}%`,
                      rank: career.ranks.passAccuracy,
                    },
                    {
                      label: 'Отборы',
                      value: career.successfulTackles,
                      rank: career.ranks.tackles,
                    },
                    {
                      label: 'Перехваты',
                      value: career.interceptions,
                      rank: career.ranks.interceptions,
                    },
                    {
                      label: 'Сухие матчи',
                      value: career.cleanSheets,
                      rank: career.ranks.cleanSheets,
                    },
                  ].map((item) => (
                    <div key={item.label} className="border-border/50 rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">{item.label}</p>
                      <p className="font-display text-xl font-bold">{item.value}</p>
                      {item.rank != null && (
                        <p className="text-accent text-xs">#{item.rank} на платформе</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Любимые позиции</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.favoritePositions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Нет данных по позициям</p>
                ) : (
                  overview.favoritePositions.map((p) => (
                    <div key={p.group}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{p.label}</span>
                        <span>{p.percentOfTotal}%</span>
                      </div>
                      <div className="bg-muted h-2 rounded-full">
                        <div
                          className="bg-accent h-2 rounded-full"
                          style={{ width: `${Math.min(100, p.percentOfTotal)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Позиционный рейтинг</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.positionRatings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Нет матчей в официальной статистике
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {overview.positionRatings.map((p) => (
                      <div
                        key={p.position}
                        className="border-border/50 rounded-lg border p-2 text-center text-sm"
                      >
                        <p className="font-medium">{p.positionLabel}</p>
                        <p className="text-accent">{p.avgMatchRating.toFixed(2)}</p>
                        <p className="text-muted-foreground text-xs">{p.matchesPlayed} матч.</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {overview.gamertagHistory.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle>История геймертега</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ник</TableHead>
                      <TableHead>С</TableHead>
                      <TableHead>По</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.gamertagHistory.map((h) => (
                      <TableRow key={`${h.gamerTag}-${h.validFrom}`}>
                        <TableCell>
                          {h.gamerTag}
                          {h.isCurrent && <Badge className="ml-2">текущий</Badge>}
                        </TableCell>
                        <TableCell>{h.validFrom.split('T')[0]}</TableCell>
                        <TableCell>{h.validTo?.split('T')[0] ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STAT_TABS.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={statSubTab === t.id ? 'default' : 'outline'}
                onClick={() => setStatSubTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
            >
              <option value="">Все амплуа</option>
              {overview.positionRatings.map((p) => (
                <option key={p.position} value={p.position}>
                  {p.positionLabel}
                </option>
              ))}
            </select>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={statCategory}
              onChange={(e) => setStatCategory(e.target.value)}
            >
              {STAT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {statSubTab === 'season' && (
                        <>
                          <TableHead>Сезон</TableHead>
                          <TableHead>XP</TableHead>
                          <TableHead>Матчи</TableHead>
                          <TableHead>G/A</TableHead>
                          <TableHead>% побед</TableHead>
                        </>
                      )}
                      {statSubTab === 'tournament' && (
                        <>
                          <TableHead>Турнир</TableHead>
                          <TableHead>Матчи</TableHead>
                          <TableHead>XP</TableHead>
                          <TableHead>G/A</TableHead>
                          <TableHead>% побед</TableHead>
                        </>
                      )}
                      {statSubTab === 'club' && (
                        <>
                          <TableHead>Клуб</TableHead>
                          <TableHead>Матчи</TableHead>
                          <TableHead>XP</TableHead>
                          <TableHead>G/A</TableHead>
                        </>
                      )}
                      {statSubTab === 'match' && (
                        <>
                          <TableHead>Матч</TableHead>
                          <TableHead>Поз.</TableHead>
                          <TableHead>Рейтинг</TableHead>
                          <TableHead>XP</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(statsData?.rows ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    ) : (
                      statsData?.rows.map((row, i) => (
                        <TableRow key={i}>
                          {statSubTab === 'season' && (
                            <>
                              <TableCell>{String(row.seasonName ?? '—')}</TableCell>
                              <TableCell>{String(row.xpEarned ?? 0)}</TableCell>
                              <TableCell>
                                {String(row.matchesPlayed ?? row.totalMatches ?? 0)}
                              </TableCell>
                              <TableCell>
                                {String(row.goals ?? 0)}/{String(row.assists ?? 0)}
                              </TableCell>
                              <TableCell>{String(row.winPercent ?? 0)}%</TableCell>
                            </>
                          )}
                          {statSubTab === 'tournament' && (
                            <>
                              <TableCell>{String(row.tournamentName ?? '—')}</TableCell>
                              <TableCell>
                                {String(row.matchesPlayed ?? row.totalMatches ?? 0)}
                              </TableCell>
                              <TableCell>{String(row.totalXp ?? 0)}</TableCell>
                              <TableCell>
                                {String(row.goals ?? 0)}/{String(row.assists ?? 0)}
                              </TableCell>
                              <TableCell>{String(row.winPercent ?? 0)}%</TableCell>
                            </>
                          )}
                          {statSubTab === 'club' && (
                            <>
                              <TableCell>
                                [{String(row.teamTag)}] {String(row.teamName)}
                              </TableCell>
                              <TableCell>{String(row.totalMatches ?? 0)}</TableCell>
                              <TableCell>{String(row.totalXp ?? 0)}</TableCell>
                              <TableCell>
                                {String(row.goals ?? 0)}/{String(row.assists ?? 0)}
                              </TableCell>
                            </>
                          )}
                          {statSubTab === 'match' && (
                            <>
                              <TableCell className="text-sm">
                                {(row.matchUrl as string | undefined) ? (
                                  <Link href={String(row.matchUrl)} className="hover:text-accent">
                                    {String(row.opponent)} {String(row.score)}
                                  </Link>
                                ) : (
                                  <>
                                    {String(row.opponent)} {String(row.score)}
                                  </>
                                )}
                                <div className="text-muted-foreground text-xs">
                                  {String(row.tournamentName ?? row.seasonName ?? '')}
                                </div>
                              </TableCell>
                              <TableCell>{String(row.positionLabel ?? row.position)}</TableCell>
                              <TableCell>{String(row.matchRating ?? '—')}</TableCell>
                              <TableCell>{String(row.xpEarned ?? 0)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клуб</TableHead>
                  <TableHead>Матчи</TableHead>
                  <TableHead>Ср. рейтинг</TableHead>
                  <TableHead>Дней в клубе</TableHead>
                  <TableHead>Период</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      История переходов пуста
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((t) => (
                    <TableRow key={t.team.id}>
                      <TableCell>
                        <Link href={`/teams/${t.team.id}`} className="text-accent hover:underline">
                          [{t.team.tag}] {t.team.name}
                        </Link>
                        {t.isCurrent && <Badge className="ml-2">текущий</Badge>}
                      </TableCell>
                      <TableCell>{t.matchesPlayed}</TableCell>
                      <TableCell>{t.avgMatchRating.toFixed(2)}</TableCell>
                      <TableCell>{t.daysInClub}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {t.joinedAt.split('T')[0]} → {t.leftAt?.split('T')[0] ?? 'н.в.'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'awards' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {AWARD_CATEGORIES.map((c) => (
              <Button
                key={c.id || 'all'}
                size="sm"
                variant={awardCategory === c.id ? 'default' : 'outline'}
                onClick={() => setAwardCategory(c.id)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {awards.length === 0 ? (
              <p className="text-muted-foreground">Наград пока нет</p>
            ) : (
              awards.map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="text-3xl">{a.iconEmoji}</div>
                    <h3 className="mt-2 font-medium">{a.name}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{a.description}</p>
                    <p className="text-accent mt-2 text-xs">{a.awardedForText}</p>
                    <p className="text-muted-foreground text-xs">{a.awardedAt.split('T')[0]}</p>
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => togglePin(a.id, !a.isPinned)}
                      >
                        {a.isPinned ? 'Открепить' : 'В избранное'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
