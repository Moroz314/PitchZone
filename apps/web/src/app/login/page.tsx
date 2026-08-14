'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@pitchzone/ui';

import { getSteamLoginUrl } from '@/lib/api';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Неверный email или пароль');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  function handleDiscordLogin() {
    signIn('discord', { callbackUrl });
  }

  function handleSteamLogin() {
    const returnUrl = `${window.location.origin}/auth/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    window.location.href = getSteamLoginUrl(returnUrl);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="glass w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Вход в PitchZone</CardTitle>
          <CardDescription>Войдите, чтобы участвовать в турнирах</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card text-muted-foreground px-2">или</span>
            </div>
          </div>

          <div className="grid gap-3">
            <Button variant="outline" type="button" onClick={handleDiscordLogin} className="w-full">
              Войти через Discord
            </Button>
            <Button variant="outline" type="button" onClick={handleSteamLogin} className="w-full">
              Войти через Steam
            </Button>
          </div>

          <p className="text-muted-foreground text-center text-sm">
            Нет аккаунта?{' '}
            <Link href="/register" className="text-accent hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
