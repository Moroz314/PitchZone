'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { EaSyncPage as EaSyncContent } from '@/components/moderation/ea-sync-page';

function isModerator(role?: string) {
  return role === 'MODERATOR' || role === 'ADMIN';
}

export default function ModerationEaSyncRoute() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/moderation/ea-sync');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="text-muted-foreground py-16 text-center">Загрузка…</div>;
  }

  if (!session?.user || !isModerator(session.user.role)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Доступ только для StatTracker / администраторов</p>
        <Link href="/" className="text-accent mt-4 inline-block hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  return <EaSyncContent />;
}
