'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@pitchzone/ui';

import { createTeam } from '@/lib/api';

export default function CreateTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [countryCode, setCountryCode] = useState('RU');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/teams/create');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');
    try {
      const team = await createTeam(session.accessToken, {
        name,
        tag: tag.toUpperCase(),
        description: description || undefined,
        countryCode: countryCode || undefined,
      });
      router.push(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания команды');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/" className="text-muted-foreground hover:text-accent text-sm">
          ← На главную
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold">Создать команду</h1>
        <p className="text-muted-foreground mt-2">
          Вы станете владельцем и сможете приглашать игроков по никнейму
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Данные команды</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Neon Esports"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">Тег (до 5 символов)</Label>
              <Input
                id="tag"
                required
                maxLength={5}
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                placeholder="NEON"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Код страны</Label>
              <Input
                id="country"
                maxLength={2}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Профессиональная команда по EA FC"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Создание...' : 'Создать команду'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
