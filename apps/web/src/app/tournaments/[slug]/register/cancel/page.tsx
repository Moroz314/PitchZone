'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@pitchzone/ui';

interface CancelPageProps {
  params: Promise<{ slug: string }>;
}

export default function RegisterCancelPage({ params }: CancelPageProps) {
  const [slug, setSlug] = useState('');

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Card>
        <CardHeader>
          <CardTitle>Оплата отменена</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Вы не завершили оплату. Регистрация не активирована — можно попробовать снова.
          </p>
          {slug && (
            <Button asChild>
              <Link href={`/tournaments/${slug}`}>Вернуться к турниру</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
