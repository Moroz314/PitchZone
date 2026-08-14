'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@pitchzone/ui';

import { getTournaments, registerForTournament, type TournamentListItem } from '@/lib/api';
import { formatCurrency, isRegistrationOpen } from '@/lib/mock-data';

export function JoinTournamentDialog() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [selected, setSelected] = useState<TournamentListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getTournaments('REGISTRATION_OPEN')
      .then(setTournaments)
      .catch(() => setTournaments([]));
  }, []);

  async function handleRegister() {
    if (!selected) return;

    if (!session?.accessToken) {
      router.push(`/login?callbackUrl=/tournaments/${selected.slug}`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await registerForTournament(session.accessToken, selected.id, {});
      if (result.requiresPayment && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      if (!result.requiresPayment) {
        router.push(`/tournaments/${selected.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  const openTournaments = tournaments.filter((t) => isRegistrationOpen(t.status));

  return (
    <section className="border-border/50 border-t px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-bold">Готовы к матчу?</h2>
        <p className="text-muted-foreground mt-2">
          Зарегистрируйтесь на турнир — оплата взноса через Stripe (или демо-режим)
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" className="mt-6">
              Участвовать в турнире
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Регистрация на турнир</DialogTitle>
              <DialogDescription>Выберите турнир с открытой регистрацией</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {openTournaments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Нет доступных турниров</p>
              ) : (
                openTournaments.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected?.id === t.id ? 'border-accent bg-accent/10' : 'border-border'
                    }`}
                  >
                    <p className="font-medium">{t.title}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatCurrency(t.prizePool)} · взнос {formatCurrency(t.entryFee)}
                    </p>
                  </button>
                ))
              )}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button variant="outline">Отмена</Button>
              <Button onClick={handleRegister} disabled={!selected || loading}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
