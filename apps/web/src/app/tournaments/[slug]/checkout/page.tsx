'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@pitchzone/ui';

import { completeMockPayment, getTournamentBySlug } from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export default function TournamentCheckoutPage({ params }: CheckoutPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const participantId = searchParams.get('participantId');

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/tournaments/${slug}/checkout`);
    }
  }, [status, slug, router]);

  async function handleMockPay() {
    if (!session?.accessToken || !participantId) return;
    setLoading(true);
    setError('');
    try {
      await completeMockPayment(session.accessToken, participantId);
      router.push(`/tournaments/${slug}/register/success?mock=true&participantId=${participantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Оплата взноса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Демо-режим: Stripe не настроен. Нажмите кнопку ниже, чтобы симулировать оплату.
          </p>
          {slug && <MockTournamentFee slug={slug} />}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button className="w-full" onClick={handleMockPay} disabled={loading || !participantId}>
            {loading ? 'Обработка...' : 'Симулировать оплату'}
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href={`/tournaments/${slug}`}>Вернуться к турниру</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MockTournamentFee({ slug }: { slug: string }) {
  const [fee, setFee] = useState<number | null>(null);

  useEffect(() => {
    getTournamentBySlug(slug)
      .then((t) => setFee(t.entryFee))
      .catch(() => setFee(null));
  }, [slug]);

  if (fee === null) return null;
  return (
    <p className="font-display text-accent text-2xl font-bold">К оплате: {formatCurrency(fee)}</p>
  );
}
