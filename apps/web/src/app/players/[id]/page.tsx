import { notFound } from 'next/navigation';

import { ProfileHeader } from '@/components/players/profile-sections';
import { PlayerProfileTabs } from '@/components/players/player-profile-tabs';
import { getPlayer, getPlayerProfileOverview } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface PlayerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params;

  let profile;
  let overview;
  try {
    [profile, overview] = await Promise.all([getPlayer(id), getPlayerProfileOverview(id)]);
  } catch {
    notFound();
  }

  const cardRating = overview.card.rating;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ProfileHeader
        player={{
          id: profile.id,
          nickname: profile.nickname,
          country: profile.country ?? '',
          countryCode: profile.countryCode ?? '',
          rating: cardRating,
          rank: profile.rank,
          wins: profile.wins,
          losses: profile.losses,
          winRate: profile.winRate,
          tournamentsPlayed: profile.tournamentsPlayed,
          joinedAt: profile.joinedAt,
        }}
      />

      {profile.bio && <p className="text-muted-foreground mt-4">{profile.bio}</p>}

      <div className="mt-8">
        <PlayerProfileTabs overview={overview} />
      </div>
    </div>
  );
}
