import { getTournaments, type TournamentListItem } from '@/lib/api';

import { TournamentCard } from '../tournaments/tournament-card';
import { CreateTournamentButton } from '../tournaments/create-tournament-button';

export async function FeaturedTournaments() {
  let tournaments: TournamentListItem[] = [];
  try {
    tournaments = await getTournaments();
  } catch {
    tournaments = [];
  }

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold">Актуальные турниры</h2>
            <p className="text-muted-foreground mt-2">
              Выберите турнир и зарегистрируйтесь за минуту
            </p>
          </div>
          <CreateTournamentButton />
        </div>

        {tournaments.length === 0 ? (
          <p className="text-muted-foreground text-center">Турниры скоро появятся</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tournaments.map((tournament, index) => (
              <TournamentCard key={tournament.id} tournament={tournament} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
