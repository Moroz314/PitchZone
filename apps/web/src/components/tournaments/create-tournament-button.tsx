'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { Button } from '@pitchzone/ui';

import { canCreateTournaments } from '@/lib/can-create-tournaments';

export function CreateTournamentButton() {
  const { data: session } = useSession();

  if (!canCreateTournaments(session)) return null;

  return (
    <Button asChild>
      <Link href="/tournaments/create">Создать турнир</Link>
    </Button>
  );
}
