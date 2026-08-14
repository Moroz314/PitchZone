'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@pitchzone/ui';

import { KitPreview } from '@/components/clubs/kit-preview';
import { getPlayer, searchClubs, type ClubListItem } from '@/lib/api';

type MyTeam = {
  id: string;
  name: string;
  tag: string;
  avatar: string | null;
  role: string;
};

export default function ClubsPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState('');
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);

  const loadClubs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await searchClubs(q || undefined);
      setClubs(data.items);
      setTotal(data.total);
    } catch {
      setClubs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadClubs(query), 300);
    return () => clearTimeout(timer);
  }, [query, loadClubs]);

  useEffect(() => {
    if (!session?.user?.id) {
      setMyTeams([]);
      return;
    }
    getPlayer(session.user.id)
      .then((profile) => setMyTeams(profile.teams))
      .catch(() => setMyTeams([]));
  }, [session?.user?.id]);

  const primaryTeam = myTeams[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Клубы</h1>
        <p className="mt-2 text-muted-foreground">
          Все клубы PitchZone — найдите команду или создайте свою
        </p>
      </div>

      <Card className="glass mb-8">
        <CardHeader>
          <CardTitle>Ваш клуб</CardTitle>
        </CardHeader>
        <CardContent>
          {primaryTeam ? (
            <Link
              href={`/teams/${primaryTeam.id}`}
              className="flex items-center gap-4 rounded-lg border border-border/60 p-4 transition-colors hover:border-accent/40 hover:bg-muted/30"
            >
              <Avatar className="h-14 w-14">
                <AvatarImage src={primaryTeam.avatar ?? undefined} />
                <AvatarFallback>{primaryTeam.tag.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-display text-lg font-semibold">{primaryTeam.name}</p>
                <p className="text-sm text-muted-foreground">
                  [{primaryTeam.tag}] ·{' '}
                  {primaryTeam.role === 'OWNER'
                    ? 'Владелец'
                    : primaryTeam.role === 'CAPTAIN'
                      ? 'Капитан'
                      : 'Игрок'}
                </p>
              </div>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 p-6 text-center">
              <p className="text-muted-foreground">Здесь будет клуб, в котором вы состоите</p>
              {session?.user ? (
                <Button className="mt-4" asChild>
                  <Link href="/clubs/create">Создать свой клуб</Link>
                </Button>
              ) : (
                <Button className="mt-4" variant="outline" asChild>
                  <Link href="/login?callbackUrl=/clubs">Войти, чтобы создать клуб</Link>
                </Button>
              )}
            </div>
          )}
          {myTeams.length > 1 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Вы также состоите в:{' '}
              {myTeams.slice(1).map((t, i) => (
                <span key={t.id}>
                  {i > 0 ? ', ' : ''}
                  <Link href={`/teams/${t.id}`} className="text-accent hover:underline">
                    {t.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <Input
          placeholder="Поиск по названию или тегу…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : clubs.length === 0 ? (
        <p className="text-muted-foreground">Клубы не найдены</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {clubs.map((club) => (
            <Link key={club.id} href={`/teams/${club.id}`}>
              <Card className="glass h-full transition-colors hover:border-accent/30">
                <CardContent className="flex gap-4 p-4">
                  {club.kitTemplateId ? (
                    <KitPreview
                      templateId={club.kitTemplateId}
                      primaryColor={club.primaryColor}
                      secondaryColor={club.secondaryColor}
                      accentColor={club.accentColor}
                      className="h-16 w-12 shrink-0"
                    />
                  ) : (
                    <Avatar className="h-16 w-16 shrink-0">
                      <AvatarImage src={club.avatar ?? undefined} />
                      <AvatarFallback>{club.tag.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold">{club.name}</p>
                    <p className="text-sm text-muted-foreground">
                      [{club.tag}]
                      {club.countryCode ? ` · ${club.countryCode}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {club.memberCount} игроков · рейтинг {club.avgRating}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && total > clubs.length && (
        <p className="mt-4 text-xs text-muted-foreground">
          Показано {clubs.length} из {total}
        </p>
      )}
    </div>
  );
}
