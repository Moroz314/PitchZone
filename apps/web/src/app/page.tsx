import { FeaturedTournaments } from '@/components/home/featured-tournaments';
import { HeroSection } from '@/components/home/hero-section';
import { JoinTournamentDialog } from '@/components/home/join-tournament-dialog';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedTournaments />
      <JoinTournamentDialog />
    </>
  );
}
