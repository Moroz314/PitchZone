import { notFound } from 'next/navigation';

import { TournamentPageClient } from '@/components/tournaments/tournament-page-client';
import { getTournamentBySlug } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface TournamentPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
}

export default async function TournamentPage({ params, searchParams }: TournamentPageProps) {
  const { slug } = await params;
  const { invite } = await searchParams;

  let tournament;
  try {
    tournament = await getTournamentBySlug(slug, { invite });
  } catch {
    notFound();
  }

  return <TournamentPageClient initialTournament={tournament} />;
}
