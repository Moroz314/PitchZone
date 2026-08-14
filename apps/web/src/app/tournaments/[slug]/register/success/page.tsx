'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@pitchzone/ui';

import { verifyPaymentSession } from '@/lib/api';

interface SuccessPageProps {
  params: Promise<{ slug: string }>;
}

export default function RegisterSuccessPage({ params }: SuccessPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const sessionId = searchParams.get('session_id');
  const isMock = searchParams.get('mock') === 'true';

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (isMock) {
      setStatus('success');
      return;
    }

    if (!session?.accessToken || !sessionId) {
      setStatus('error');
      return;
    }

    verifyPaymentSession(session.accessToken, sessionId)
      .then((res) => setStatus(res.status === 'paid' ? 'success' : 'error'))
      .catch(() => setStatus('error'));
  }, [session?.accessToken, sessionId, isMock]);

  useEffect(() => {
    if (status === 'success' && slug) {
      router.refresh();
    }
  }, [status, slug, router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Card>
        <CardHeader>
          <CardTitle>
            {status === 'loading' && 'Проверка оплаты...'}
            {status === 'success' && 'Регистрация завершена!'}
            {status === 'error' && 'Ошибка оплаты'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <p className="text-muted-foreground">Взнос зачислен в эскроу турнира. Вы участник!</p>
          )}
          {status === 'error' && (
            <p className="text-destructive">Не удалось подтвердить платёж. Попробуйте снова.</p>
          )}
          {slug && (
            <Button asChild>
              <Link href={`/tournaments/${slug}`}>К турниру</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
