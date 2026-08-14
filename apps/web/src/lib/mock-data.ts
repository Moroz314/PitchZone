export type TournamentStatus =
  | 'draft'
  | 'pending_moderation'
  | 'registration_open'
  | 'registration_closed'
  | 'bracket_generated'
  | 'live'
  | 'finished'
  | 'cancelled';

export interface Tournament {
  id: string;
  slug: string;
  title: string;
  game: string;
  format: string;
  prizePool: number;
  entryFee: number;
  participants: number;
  maxParticipants: number;
  status: TournamentStatus;
  startsAt: string;
  bannerGradient: string;
}

export interface Player {
  id: string;
  nickname: string;
  country: string;
  countryCode: string;
  rating: number;
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentsPlayed: number;
  totalEarnings: number;
  joinedAt: string;
  stats: {
    attack: number;
    defense: number;
    passing: number;
    positioning: number;
    consistency: number;
  };
  ratingHistory: { date: string; rating: number }[];
  recentMatches: {
    id: string;
    opponent: string;
    score: string;
    result: 'win' | 'loss';
    tournament: string;
    date: string;
  }[];
}

export interface BracketMatch {
  id: string;
  round: number;
  player1: string;
  player2: string;
  score1?: number;
  score2?: number;
  status: 'pending' | 'live' | 'finished';
  isActive?: boolean;
}

export const FEATURED_TOURNAMENTS: Tournament[] = [
  {
    id: '1',
    slug: 'ea-fc-winter-cup',
    title: 'EA FC Winter Cup 2026',
    game: 'EA FC 25',
    format: 'Single Elimination',
    prizePool: 50000,
    entryFee: 500,
    participants: 28,
    maxParticipants: 32,
    status: 'registration_open',
    startsAt: '2026-08-15T18:00:00Z',
    bannerGradient: 'from-accent/30 via-accent-cyan/20 to-transparent',
  },
  {
    id: '2',
    slug: 'neon-league-s3',
    title: 'Neon League Season 3',
    game: 'EA FC 25',
    format: 'Double Elimination',
    prizePool: 120000,
    entryFee: 1000,
    participants: 64,
    maxParticipants: 64,
    status: 'live',
    startsAt: '2026-08-10T12:00:00Z',
    bannerGradient: 'from-live/30 via-accent/10 to-transparent',
  },
  {
    id: '3',
    slug: 'pitchzone-open-aug',
    title: 'PitchZone Open — August',
    game: 'eFootball 2026',
    format: 'Round Robin',
    prizePool: 25000,
    entryFee: 250,
    participants: 16,
    maxParticipants: 16,
    status: 'finished',
    startsAt: '2026-08-01T14:00:00Z',
    bannerGradient: 'from-muted-foreground/20 to-transparent',
  },
  {
    id: '4',
    slug: 'pro-goal-arena',
    title: 'ProGoal Arena Invitational',
    game: 'EA FC 25',
    format: 'Swiss System',
    prizePool: 75000,
    entryFee: 750,
    participants: 12,
    maxParticipants: 24,
    status: 'registration_open',
    startsAt: '2026-08-20T16:00:00Z',
    bannerGradient: 'from-accent/20 via-accent-cyan/15 to-transparent',
  },
];

export const MOCK_PLAYER: Player = {
  id: 'player-1',
  nickname: 'NeonStriker',
  country: 'Россия',
  countryCode: 'RU',
  rating: 1847,
  rank: 42,
  wins: 156,
  losses: 89,
  winRate: 63.7,
  tournamentsPlayed: 34,
  totalEarnings: 87500,
  joinedAt: '2025-03-15',
  stats: {
    attack: 88,
    defense: 72,
    passing: 81,
    positioning: 79,
    consistency: 85,
  },
  ratingHistory: [
    { date: '2026-02', rating: 1650 },
    { date: '2026-03', rating: 1702 },
    { date: '2026-04', rating: 1735 },
    { date: '2026-05', rating: 1780 },
    { date: '2026-06', rating: 1810 },
    { date: '2026-07', rating: 1832 },
    { date: '2026-08', rating: 1847 },
  ],
  recentMatches: [
    {
      id: 'm1',
      opponent: 'CyberKeeper',
      score: '3:1',
      result: 'win',
      tournament: 'Neon League S3',
      date: '2026-08-10',
    },
    {
      id: 'm2',
      opponent: 'PitchMaster',
      score: '2:2',
      result: 'loss',
      tournament: 'Neon League S3',
      date: '2026-08-09',
    },
    {
      id: 'm3',
      opponent: 'GoalHunter',
      score: '4:0',
      result: 'win',
      tournament: 'PitchZone Open',
      date: '2026-08-05',
    },
    {
      id: 'm4',
      opponent: 'EliteDribbler',
      score: '1:3',
      result: 'loss',
      tournament: 'PitchZone Open',
      date: '2026-08-04',
    },
    {
      id: 'm5',
      opponent: 'ZoneBreaker',
      score: '2:1',
      result: 'win',
      tournament: 'EA FC Winter Cup',
      date: '2026-08-01',
    },
  ],
};

export const BRACKET_MATCHES: BracketMatch[] = [
  {
    id: 'qf1',
    round: 1,
    player1: 'NeonStriker',
    player2: 'CyberKeeper',
    score1: 3,
    score2: 1,
    status: 'finished',
  },
  {
    id: 'qf2',
    round: 1,
    player1: 'PitchMaster',
    player2: 'GoalHunter',
    score1: 2,
    score2: 0,
    status: 'finished',
  },
  {
    id: 'qf3',
    round: 1,
    player1: 'EliteDribbler',
    player2: 'ZoneBreaker',
    status: 'live',
    isActive: true,
  },
  {
    id: 'qf4',
    round: 1,
    player1: 'ProStriker',
    player2: 'DarkKeeper',
    score1: 1,
    score2: 2,
    status: 'finished',
  },
  {
    id: 'sf1',
    round: 2,
    player1: 'NeonStriker',
    player2: 'PitchMaster',
    status: 'pending',
  },
  {
    id: 'sf2',
    round: 2,
    player1: 'TBD',
    player2: 'DarkKeeper',
    status: 'pending',
  },
  {
    id: 'final',
    round: 3,
    player1: 'TBD',
    player2: 'TBD',
    status: 'pending',
  },
];

export const PLATFORM_STATS = {
  activeTournaments: 12,
  totalPlayers: 4820,
  prizePoolPaid: 2400000,
  matchesToday: 847,
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCountdown(startsAt: string): string {
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return 'Скоро';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}д ${hours}ч`;
  return `${hours}ч`;
}

export function isRegistrationOpen(status: TournamentStatus): boolean {
  return status === 'registration_open';
}

export function getStatusLabel(status: TournamentStatus): string {
  const labels: Record<TournamentStatus, string> = {
    draft: 'Черновик',
    pending_moderation: 'На модерации',
    registration_open: 'Регистрация',
    registration_closed: 'Рег. закрыта',
    bracket_generated: 'Сетка готова',
    live: 'Live',
    finished: 'Завершён',
    cancelled: 'Отменён',
  };
  return labels[status];
}

export function getStatusBadgeVariant(status: TournamentStatus) {
  const variants: Record<
    TournamentStatus,
    'open' | 'live' | 'finished' | 'secondary' | 'destructive' | 'warning'
  > = {
    draft: 'secondary',
    pending_moderation: 'warning',
    registration_open: 'open',
    registration_closed: 'secondary',
    bracket_generated: 'warning',
    live: 'live',
    finished: 'finished',
    cancelled: 'destructive',
  };
  return variants[status];
}

export function getTournamentBySlug(slug: string): Tournament | undefined {
  return FEATURED_TOURNAMENTS.find((t) => t.slug === slug);
}

export function calculatePrizePoolPreview(
  prizePoolType: 'FROM_FEES' | 'FIXED_SPONSORED',
  entryFee: number,
  maxParticipants: number,
  commissionPercent: number,
  fixedPrizePool: number,
): number {
  if (prizePoolType === 'FIXED_SPONSORED') return fixedPrizePool;
  return Math.floor(entryFee * maxParticipants * (1 - commissionPercent / 100));
}
