'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pitchzone/ui';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const callbackUrl = searchParams.get('callbackUrl') ?? '/';

    if (!token) {
      setError('Токен авторизации не получен');
      return;
    }

    signIn('token', { token, redirect: false }).then((result) => {
      if (result?.error) {
        setError('Не удалось завершить авторизацию');
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  }, [searchParams, router]);

  if (error) {
    return (
      <Card className="glass w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Ошибка</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="glass w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Авторизация...</CardTitle>
        <CardDescription>Пожалуйста, подождите</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </CardContent>
    </Card>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Suspense>
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}
