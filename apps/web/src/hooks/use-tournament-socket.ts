'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { type BracketMatch, type TournamentDetail } from '@/lib/api';

const WS_BASE = 'https://pitchzone-api-morozzz.amvera.io';

interface UseTournamentSocketOptions {
  slug: string;
  initialTournament: TournamentDetail;
  onUpdate?: (tournament: TournamentDetail) => void;
}

export function useTournamentSocket({
  slug,
  initialTournament,
  onUpdate,
}: UseTournamentSocketOptions) {
  const [tournament, setTournament] = useState(initialTournament);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setTournament(initialTournament);
  }, [initialTournament]);

  useEffect(() => {
    const socket: Socket = io(`${WS_BASE}/tournaments`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', slug);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('tournament:update', (data: TournamentDetail) => {
      setTournament(data);
      onUpdate?.(data);
    });

    socket.on(
      'bracket:update',
      (data: { tournament: TournamentDetail; matches: BracketMatch[] }) => {
        const merged = { ...data.tournament, matches: data.matches };
        setTournament(merged);
        onUpdate?.(merged);
      },
    );

    socket.on('match:update', (data: { match: BracketMatch; tournament: TournamentDetail }) => {
      setTournament((prev) => {
        const matches = prev.matches.map((m) => (m.id === data.match.id ? data.match : m));
        const merged = { ...data.tournament, matches };
        onUpdate?.(merged);
        return merged;
      });
    });

    return () => {
      socket.emit('leave', slug);
      socket.disconnect();
    };
  }, [slug, onUpdate]);

  return { tournament, connected };
}
