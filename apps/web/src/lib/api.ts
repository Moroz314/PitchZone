const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface ApiUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  countryCode: string | null;
  rating: number;
  role?: string;
  canCreateTournaments?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: ApiUser;
}

export interface PlayerProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  countryCode: string | null;
  bio: string | null;
  joinedAt: string;
  rating: number;
  cardRating?: number;
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentsPlayed: number;
  totalEarnings: number;
  teams: {
    id: string;
    name: string;
    tag: string;
    avatar: string | null;
    role: string;
    eaClubId: string | null;
    needsReverification: boolean;
  }[];
}

export interface TeamProfile {
  id: string;
  name: string;
  tag: string;
  avatar: string | null;
  country: string | null;
  countryCode: string | null;
  description: string | null;
  vkGroupUrl?: string | null;
  twitchUrl?: string | null;
  youtubeUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string | null;
  kitTemplateId?: string | null;
  kitTemplateName?: string | null;
  coverBannerUrl?: string | null;
  createdAt: string;
  avgRating: number;
  totalWins: number;
  totalLosses: number;
  totalDraws?: number;
  memberCount: number;
  owner: { id: string; nickname: string | undefined; avatar: string | null | undefined };
  members: {
    id: string;
    nickname: string | undefined;
    avatar: string | null | undefined;
    countryCode: string | null | undefined;
    rating: number;
    wins: number;
    losses: number;
    role: string;
    joinedAt: string;
  }[];
  tournamentStats?: {
    tournamentId: string;
    tournamentSlug: string;
    tournamentTitle: string;
    tournamentStatus: string;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    updatedAt: string;
  }[];
}

/** Next.js иногда передаёт slug уже в percent-encoding — декодируем перед запросом к API. */
export function normalizeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    throw new Error(message ?? `API error: ${res.status}`);
  }

  return res.json();
}

export async function registerUser(data: {
  email: string;
  password: string;
  nickname: string;
  country?: string;
  countryCode?: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export async function loginUser(data: { email: string; password: string }): Promise<AuthResponse> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) });
}

export async function oauthSync(data: {
  provider: 'DISCORD' | 'STEAM';
  providerAccountId: string;
  email?: string;
  nickname?: string;
  avatar?: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/oauth', { method: 'POST', body: JSON.stringify(data) });
}

export async function validateToken(token: string): Promise<AuthResponse> {
  return apiFetch('/auth/validate', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function getPlayer(id: string): Promise<PlayerProfile> {
  return apiFetch(`/users/${id}`);
}

export async function getPlayerByNickname(nickname: string): Promise<PlayerProfile> {
  return apiFetch(`/users/nickname/${encodeURIComponent(nickname)}`);
}

export async function getTeam(id: string): Promise<TeamProfile> {
  return apiFetch(`/teams/${id}`);
}

export async function getTeamByTag(tag: string): Promise<TeamProfile> {
  return apiFetch(`/teams/tag/${encodeURIComponent(tag)}`);
}

export interface ClubListItem {
  id: string;
  name: string;
  tag: string;
  avatar: string | null;
  country: string | null;
  countryCode: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  kitTemplateId: string | null;
  kitTemplateName: string | null;
  memberCount: number;
  avgRating: number;
}

export async function searchClubs(
  q?: string,
  options?: { skip?: number; take?: number },
): Promise<{ total: number; items: ClubListItem[] }> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (options?.skip != null) params.set('skip', String(options.skip));
  if (options?.take != null) params.set('take', String(options.take));
  const query = params.toString();
  return apiFetch(`/teams${query ? `?${query}` : ''}`);
}

export async function getLeaderboard(): Promise<
  {
    rank: number;
    id: string;
    nickname: string | undefined;
    avatar: string | null | undefined;
    countryCode: string | null | undefined;
    rating: number;
    wins: number;
    losses: number;
  }[]
> {
  return apiFetch('/users/leaderboard');
}

export async function updateProfile(
  token: string,
  data: {
    nickname?: string;
    avatar?: string;
    country?: string;
    countryCode?: string;
    bio?: string;
  },
): Promise<PlayerProfile> {
  return apiFetch('/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function createTeam(
  token: string,
  data: {
    name: string;
    tag: string;
    country?: string;
    countryCode?: string;
    description?: string;
  },
): Promise<TeamProfile> {
  return apiFetch('/teams', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface TeamInvite {
  id: string;
  teamId: string;
  team: { id: string; name: string; tag: string; avatar: string | null };
  inviterNickname?: string;
  expiresAt: string;
  createdAt: string;
}

export interface PendingTeamInvite {
  id: string;
  inviteeId: string;
  nickname?: string;
  avatar?: string | null;
  expiresAt: string;
  createdAt: string;
}

export async function inviteToTeam(
  token: string,
  teamId: string,
  nickname: string,
): Promise<{ id: string; token: string }> {
  return apiFetch(`/teams/${teamId}/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nickname }),
  });
}

export async function acceptTeamInvite(
  token: string,
  teamId: string,
  inviteId: string,
): Promise<TeamProfile> {
  return apiFetch(`/teams/${teamId}/accept-invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inviteId }),
  });
}

export async function declineTeamInvite(
  token: string,
  inviteId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/teams/invites/${inviteId}/decline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyTeamInvites(token: string): Promise<TeamInvite[]> {
  return apiFetch('/teams/invites/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTeamPendingInvites(
  token: string,
  teamId: string,
): Promise<PendingTeamInvite[]> {
  return apiFetch(`/teams/${teamId}/pending-invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function removeTeamMember(
  token: string,
  teamId: string,
  userId: string,
): Promise<TeamProfile | { success: boolean }> {
  return apiFetch(`/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getSteamLoginUrl(returnUrl: string): string {
  return `${API_BASE}/auth/steam?returnUrl=${encodeURIComponent(returnUrl)}`;
}

export type TournamentStatus =
  | 'draft'
  | 'pending_moderation'
  | 'registration_open'
  | 'registration_closed'
  | 'bracket_generated'
  | 'live'
  | 'finished'
  | 'cancelled';

export interface PrizePlace {
  place: number;
  percent: number;
}

export interface TournamentListItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  bannerUrl?: string | null;
  game: string;
  gameKey?: string;
  format: string;
  formatKey: string;
  matchFormat?: string;
  teamSize?: number;
  prizePool: number;
  entryFee: number;
  participants: number;
  maxParticipants: number;
  minParticipants?: number;
  status: TournamentStatus;
  visibility?: string;
  registrationDeadline?: string | null;
  startsAt: string;
  bannerGradient: string;
  organizerId?: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  position?: number;
  participant1Id?: string;
  participant2Id?: string;
  player1: string;
  player2: string;
  score1?: number;
  score2?: number;
  status:
    | 'scheduled'
    | 'pending'
    | 'in_progress'
    | 'awaiting_confirmation'
    | 'completed'
    | 'disputed'
    | 'cancelled';
  isActive?: boolean;
  scheduledAt?: string;
  confirmationDeadline?: string;
  eaSyncStatus?: 'awaiting_ea' | 'synced' | 'needs_review' | 'manual';
  eaSyncNote?: string;
  eaMatchId?: string;
}

export interface TournamentMatchDetail {
  id: string;
  tournament: { id: string; slug: string; title: string; status: string };
  round: number;
  match: BracketMatch;
  team1: { id: string; name: string; tag: string };
  team2: { id: string; name: string; tag: string };
  score1: number | null;
  score2: number | null;
  status: string;
  playedAt: string | null;
  eaMatchId: string | null;
  eaSyncStatus?: string;
  eaSyncNote?: string | null;
  statsCount: number;
  team1EaPlayers: EaMatchPlayerStat[];
  team2EaPlayers: EaMatchPlayerStat[];
}

export interface BracketSeedParticipant {
  id: string;
  seed: number;
  name: string;
  rating: number | null;
}

export interface TournamentParticipant {
  id: string;
  seed: number;
  type: string;
  name: string;
  userId?: string;
  teamId?: string;
  teamTag?: string;
  avatarUrl?: string | null;
  rating: number | null;
  paymentStatus?: string;
  placement?: number;
  prizeAmount?: number;
}

export interface TournamentLeagueEntry {
  position: number;
  participantId: string;
  name: string;
  teamId?: string;
  userId?: string;
  avatarUrl?: string | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TournamentResults {
  standings: {
    participantId: string;
    place: number;
    name: string;
    prizeAmount: number;
  }[];
  totalPaid: number;
  escrowStatus: string;
}

export interface TournamentEscrow {
  totalHeld: number;
  status: string;
  currency: string;
}

export interface TournamentDetail extends Omit<TournamentListItem, 'participants'> {
  organizerId: string;
  prizePoolType?: string;
  fixedPrizePool?: number | null;
  platformCommissionPercent?: number;
  prizeDistribution?: PrizePlace[];
  rulesText?: string | null;
  proofRequirement?: string;
  participantCount: number;
  participants: TournamentParticipant[];
  escrow?: TournamentEscrow | null;
  results?: TournamentResults;
  leagueTable: TournamentLeagueEntry[];
  matches: BracketMatch[];
  access?: {
    canRegister: boolean;
    hasValidInviteLink: boolean;
    reason: string | null;
    isOrganizer: boolean;
  };
  inviteLink?: string | null;
  invites?: TournamentInvite[];
}

export interface TournamentInvite {
  id: string;
  status: string;
  createdAt: string;
  user: { id: string; nickname: string } | null;
  team: { id: string; name: string; tag: string } | null;
}

export type RegisterResponse =
  | { requiresPayment: false; tournament: TournamentDetail }
  | {
      requiresPayment: true;
      mockPayment?: boolean;
      checkoutUrl: string | null;
      sessionId?: string;
      participantId: string;
    };

export interface WalletInfo {
  id: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  withdrawalMethod?: string | null;
  failureReason?: string | null;
  tournament: { id: string; slug: string; title: string } | null;
  createdAt: string;
  processedAt?: string | null;
}

export interface WalletWithdrawConfig {
  mockMode: boolean;
  minAmount: number;
}

export type WithdrawalMethod = 'CARD' | 'BANK';

export interface WithdrawResponse {
  transaction: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: WithdrawalMethod | null;
    failureReason: string | null;
    createdAt: string;
    processedAt: string | null;
  };
  wallet: {
    balance: number;
    currency: string;
  };
}

export interface PaymentConfig {
  stripeEnabled: boolean;
  mockMode: boolean;
  publishableKey: string | null;
}

export interface CreateTournamentPayload {
  title: string;
  slug?: string;
  description?: string;
  bannerUrl?: string;
  game?: string;
  format?: string;
  matchFormat?: string;
  teamSize?: number;
  maxParticipants?: number;
  minParticipants?: number;
  startsAt?: string;
  registrationDeadline?: string;
  prizePoolType?: string;
  entryFee?: number;
  fixedPrizePool?: number;
  platformCommissionPercent?: number;
  prizeDistribution?: PrizePlace[];
  rulesText?: string;
  proofRequirement?: string;
  visibility?: string;
  bannerGradient?: string;
}

export async function getTournaments(status?: string): Promise<TournamentListItem[]> {
  const query = status ? `?status=${status}` : '';
  return apiFetch(`/tournaments${query}`);
}

export async function getMyTournaments(token: string): Promise<TournamentListItem[]> {
  return apiFetch('/tournaments/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTournamentBySlug(
  slug: string,
  options?: { token?: string; invite?: string },
): Promise<TournamentDetail> {
  const normalized = normalizeSlug(slug);
  const params = new URLSearchParams();
  if (options?.invite) params.set('invite', options.invite);
  const query = params.toString();
  return apiFetch(
    `/tournaments/slug/${encodeURIComponent(normalized)}${query ? `?${query}` : ''}`,
    {
      headers: options?.token ? { Authorization: `Bearer ${options.token}` } : undefined,
    },
  );
}

export async function registerForTournament(
  token: string,
  tournamentId: string,
  options?: { teamId?: string; inviteToken?: string },
): Promise<RegisterResponse> {
  return apiFetch(`/tournaments/${tournamentId}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      teamId: options?.teamId,
      inviteToken: options?.inviteToken,
    }),
  });
}

export async function getTournamentInvites(
  token: string,
  tournamentId: string,
): Promise<TournamentInvite[]> {
  return apiFetch(`/tournaments/${tournamentId}/invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createTournamentInvite(
  token: string,
  tournamentId: string,
  payload: { nickname?: string; teamTag?: string },
): Promise<TournamentInvite> {
  return apiFetch(`/tournaments/${tournamentId}/invites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function deleteTournamentInvite(
  token: string,
  tournamentId: string,
  inviteId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/tournaments/${tournamentId}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  return apiFetch('/payments/config');
}

export async function completeMockPayment(
  token: string,
  participantId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/payments/mock/complete/${participantId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function verifyPaymentSession(
  token: string,
  sessionId: string,
): Promise<{ status: string; participantId?: string }> {
  return apiFetch(`/payments/session/${sessionId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getWallet(token: string): Promise<WalletInfo> {
  return apiFetch('/wallet/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getWalletTransactions(token: string): Promise<WalletTransaction[]> {
  return apiFetch('/wallet/me/transactions', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getWalletWithdrawConfig(): Promise<WalletWithdrawConfig> {
  return apiFetch('/wallet/config');
}

export async function requestWithdrawal(
  token: string,
  payload: { amount: number; method: WithdrawalMethod },
): Promise<WithdrawResponse> {
  return apiFetch('/wallet/me/withdraw', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function unregisterFromTournament(
  token: string,
  tournamentId: string,
): Promise<TournamentDetail> {
  return apiFetch(`/tournaments/${tournamentId}/register`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createTournament(
  token: string,
  data: CreateTournamentPayload,
): Promise<TournamentListItem> {
  return apiFetch('/tournaments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateTournament(
  token: string,
  tournamentId: string,
  data: CreateTournamentPayload,
): Promise<TournamentDetail> {
  return apiFetch(`/tournaments/${tournamentId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function publishTournament(
  token: string,
  tournamentId: string,
): Promise<TournamentListItem> {
  return apiFetch(`/tournaments/${tournamentId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function cancelTournament(
  token: string,
  tournamentId: string,
): Promise<TournamentDetail> {
  return apiFetch(`/tournaments/${tournamentId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteTournament(
  token: string,
  tournamentId: string,
): Promise<{ success: boolean; slug: string }> {
  return apiFetch(`/tournaments/${tournamentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function reopenTournament(
  token: string,
  tournamentId: string,
  registrationDeadline: string,
): Promise<TournamentDetail> {
  return apiFetch(`/tournaments/${tournamentId}/reopen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ registrationDeadline }),
  });
}

export async function generateBracket(
  token: string,
  tournamentId: string,
): Promise<{ tournament: TournamentDetail; matches: BracketMatch[] }> {
  return apiFetch(`/tournaments/${tournamentId}/generate-bracket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTournamentBracket(tournamentId: string): Promise<{
  tournament: TournamentListItem;
  participants: BracketSeedParticipant[];
  matches: BracketMatch[];
}> {
  return apiFetch(`/tournaments/${tournamentId}/bracket`);
}

export async function getTournamentMatchDetail(matchId: string): Promise<TournamentMatchDetail> {
  return apiFetch(`/tournaments/matches/${matchId}/detail`);
}

export async function updateTournamentSeeds(
  token: string,
  tournamentId: string,
  seeds: { participantId: string; seed: number }[],
): Promise<{ tournament: TournamentDetail; matches: BracketMatch[] }> {
  return apiFetch(`/tournaments/${tournamentId}/seeds`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ seeds }),
  });
}

export async function setMatchLive(token: string, matchId: string): Promise<BracketMatch> {
  return apiFetch(`/tournaments/matches/${matchId}/live`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function startMatch(
  token: string,
  matchId: string,
): Promise<{ match: unknown; tournament: TournamentDetail }> {
  return apiFetch(`/matches/${matchId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function reportMatchScore(
  token: string,
  matchId: string,
  score1: number,
  score2: number,
  proof: File,
): Promise<{ match: unknown; tournament: TournamentDetail }> {
  const form = new FormData();
  form.append('score1', String(score1));
  form.append('score2', String(score2));
  form.append('proof', proof);

  const res = await fetch(`${API_BASE}/matches/${matchId}/report-score`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }

  return res.json();
}

export async function getMatchDetail(matchId: string) {
  return apiFetch(`/matches/${matchId}`);
}

export async function startTournament(
  token: string,
  tournamentId: string,
): Promise<TournamentDetail> {
  return apiFetch(`/tournaments/${tournamentId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateMatchScore(
  token: string,
  matchId: string,
  score1: number,
  score2: number,
): Promise<{ match: BracketMatch; tournament: TournamentDetail }> {
  return apiFetch(`/tournaments/matches/${matchId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ score1, score2 }),
  });
}

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_A' | 'RESOLVED_B' | 'REJECTED';

export interface DisputeListItem {
  id: string;
  status: DisputeStatus;
  reasonText: string | null;
  createdAt: string;
  resolvedAt?: string;
  openedBy: string;
  match: {
    id: string;
    round: number;
    player1: string | null;
    player2: string | null;
  };
  tournament: {
    id: string;
    slug: string;
    title: string;
  };
}

export interface DisputeDetail extends DisputeListItem {
  resolutionNote: string | null;
  resolvedBy: string | null;
  match: BracketMatch & {
    participant1Id?: string;
    participant2Id?: string;
    proofRequirement?: string;
  };
  submissions: {
    participantId: string;
    participantName: string;
    side: 'A' | 'B' | '?';
    score1: number;
    score2: number;
    proofUrl: string;
    submittedAt: string;
    submittedBy: string;
  }[];
}

export async function getDisputes(
  token: string,
  status?: DisputeStatus,
): Promise<DisputeListItem[]> {
  const query = status ? `?status=${status}` : '';
  return apiFetch(`/disputes${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getDispute(token: string, id: string): Promise<DisputeDetail> {
  return apiFetch(`/disputes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function reviewDispute(
  token: string,
  id: string,
  note?: string,
): Promise<DisputeDetail> {
  return apiFetch(`/disputes/${id}/review`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note }),
  });
}

export async function resolveDispute(
  token: string,
  id: string,
  data: {
    resolution: DisputeStatus;
    score1?: number;
    score2?: number;
    resolutionNote?: string;
  },
): Promise<DisputeDetail> {
  return apiFetch(`/disputes/${id}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// --- Admin ---

export interface PlatformSettings {
  defaultPlatformCommissionPercent: number;
  privateTournamentCreationFee: number;
  lanQualifyTopN?: number;
  updatedAt: string;
}

export interface AdminOverview {
  usersCount: number;
  tournamentsPendingModeration: number;
  tournamentsLive: number;
  openDisputes: number;
  escrow: { accounts: number; totalHeld: number };
  platformCommission: { total: number; transactions: number };
  withdrawals: { pending: number; completedTotal: number };
  settings: PlatformSettings;
}

export interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  role: string;
  isVerified: boolean;
  canCreateTournaments: boolean;
  rating: number;
  walletBalance: number;
  createdAt: string;
}

export interface AdminTournament {
  id: string;
  slug: string;
  title: string;
  status: string;
  statusKey: string;
  visibility: string;
  organizer: { id: string; nickname: string };
  prizePool: number;
  entryFee: number;
  platformCommissionPercent: number;
  participants: number;
  maxParticipants: number;
  escrowHeld: number;
  escrowStatus: string | null;
  startsAt: string;
  updatedAt: string;
}

export interface AdminFinanceSummary {
  byType: Record<string, { total: number; count: number }>;
  entryFeesHeld: number;
  prizesPaid: number;
  platformCommissionTotal: number;
  escrowAccounts: {
    tournamentId: string;
    slug: string;
    title: string;
    tournamentStatus: string;
    totalHeld: number;
    status: string;
    currency: string;
  }[];
  recentCommissions: {
    id: string;
    amount: number;
    tournament: { slug: string; title: string } | null;
    createdAt: string;
  }[];
  withdrawals: { status: string; total: number; count: number }[];
}

export interface AdminTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  user: { id: string; nickname: string };
  tournament: { slug: string; title: string } | null;
  failureReason: string | null;
  createdAt: string;
}

export interface AdminWithdrawal {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  failureReason: string | null;
  user: { id: string; nickname: string; walletBalance: number };
  createdAt: string;
  processedAt: string | null;
}

function adminHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return apiFetch('/platform/settings');
}

export async function getAdminOverview(token: string): Promise<AdminOverview> {
  return apiFetch('/admin/overview', { headers: adminHeaders(token) });
}

export async function getAdminUsers(
  token: string,
  params?: { search?: string; role?: string },
): Promise<{ total: number; items: AdminUser[] }> {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.role) q.set('role', params.role);
  const query = q.toString();
  return apiFetch(`/admin/users${query ? `?${query}` : ''}`, { headers: adminHeaders(token) });
}

export async function updateAdminUser(
  token: string,
  userId: string,
  data: { role?: string; isVerified?: boolean; canCreateTournaments?: boolean },
): Promise<AdminUser> {
  return apiFetch(`/admin/users/${userId}`, {
    method: 'PATCH',
    headers: adminHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function getAdminTournaments(
  token: string,
  params?: { status?: string; visibility?: string },
): Promise<{ total: number; items: AdminTournament[] }> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.visibility) q.set('visibility', params.visibility);
  const query = q.toString();
  return apiFetch(`/admin/tournaments${query ? `?${query}` : ''}`, {
    headers: adminHeaders(token),
  });
}

export async function adminApproveTournament(
  token: string,
  tournamentId: string,
): Promise<unknown> {
  return apiFetch(`/admin/tournaments/${tournamentId}/approve`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
}

export async function adminCancelTournament(
  token: string,
  tournamentId: string,
): Promise<{ success: boolean; slug: string }> {
  return apiFetch(`/admin/tournaments/${tournamentId}/cancel`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
}

export async function adminDeleteTournament(
  token: string,
  tournamentId: string,
): Promise<{ success: boolean; slug: string }> {
  return apiFetch(`/admin/tournaments/${tournamentId}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

export async function adminUpdateTournamentStatus(
  token: string,
  tournamentId: string,
  status: string,
): Promise<unknown> {
  return apiFetch(`/admin/tournaments/${tournamentId}/status`, {
    method: 'PATCH',
    headers: adminHeaders(token),
    body: JSON.stringify({ status }),
  });
}

export async function getAdminFinanceSummary(token: string): Promise<AdminFinanceSummary> {
  return apiFetch('/admin/finance/summary', { headers: adminHeaders(token) });
}

export async function getAdminTransactions(
  token: string,
  params?: { type?: string; status?: string },
): Promise<{ total: number; items: AdminTransaction[] }> {
  const q = new URLSearchParams();
  if (params?.type) q.set('type', params.type);
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  return apiFetch(`/admin/finance/transactions${query ? `?${query}` : ''}`, {
    headers: adminHeaders(token),
  });
}

export async function getAdminWithdrawals(
  token: string,
  status?: string,
): Promise<AdminWithdrawal[]> {
  const q = status ? `?status=${status}` : '';
  return apiFetch(`/admin/finance/withdrawals${q}`, { headers: adminHeaders(token) });
}

export async function adminCompleteWithdrawal(
  token: string,
  transactionId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/admin/finance/withdrawals/${transactionId}/complete`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
}

export async function adminFailWithdrawal(
  token: string,
  transactionId: string,
  reason?: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/admin/finance/withdrawals/${transactionId}/fail`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({ reason }),
  });
}

export async function getAdminSettings(token: string): Promise<PlatformSettings> {
  return apiFetch('/admin/settings', { headers: adminHeaders(token) });
}

export async function updateAdminSettings(
  token: string,
  data: Partial<PlatformSettings>,
): Promise<PlatformSettings> {
  return apiFetch('/admin/settings', {
    method: 'PATCH',
    headers: adminHeaders(token),
    body: JSON.stringify(data),
  });
}

// --- Clubs, transfers, contracts ---

export interface ClubColor {
  id: string;
  hex: string;
  label: string;
}

export interface KitTemplate {
  id: string;
  name: string;
  renderType: string;
  sortOrder: number;
}

export async function getClubColorPalette(): Promise<ClubColor[]> {
  return apiFetch('/clubs/color-palette');
}

export async function getKitTemplates(): Promise<KitTemplate[]> {
  return apiFetch('/clubs/kit-templates');
}

export async function createClub(
  token: string,
  data: {
    name: string;
    tag: string;
    country: string;
    countryCode?: string;
    vkGroupUrl?: string;
    twitchUrl?: string;
    youtubeUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    kitTemplateId: string;
  },
): Promise<TeamProfile> {
  return apiFetch('/clubs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

async function uploadClubFile(
  token: string,
  teamId: string,
  field: 'logo' | 'cover',
  file: File,
): Promise<{ avatar?: string; coverBannerUrl?: string }> {
  const form = new FormData();
  form.append(field, file);

  const res = await fetch(`${API_BASE}/clubs/${teamId}/${field === 'logo' ? 'logo' : 'cover'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }

  return res.json();
}

export function uploadClubLogo(token: string, teamId: string, file: File) {
  return uploadClubFile(token, teamId, 'logo', file);
}

export function uploadClubCover(token: string, teamId: string, file: File) {
  return uploadClubFile(token, teamId, 'cover', file);
}

export interface TransferPosition {
  value: string;
  label: string;
}

export interface PlayerTransferAd {
  id: string;
  position: string;
  positionLabel: string;
  availableDays: string[];
  aboutText: string;
  status: string;
  createdAt: string;
  player: {
    id: string;
    nickname: string;
    avatar: string | null;
    countryCode: string | null;
    rating: number;
  };
}

export interface ClubTransferAd {
  id: string;
  positionNeeded: string;
  positionLabel: string;
  requirementsText: string;
  status: string;
  createdAt: string;
  club: {
    id: string;
    name: string;
    tag: string;
    avatar: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string | null;
    kitTemplateId: string | null;
    kitTemplateName: string | null;
  };
}

export async function getTransferPositions(): Promise<TransferPosition[]> {
  return apiFetch('/transfers/positions');
}

export async function getPlayerTransferAds(): Promise<PlayerTransferAd[]> {
  return apiFetch('/transfers/players');
}

export async function getClubTransferAds(): Promise<ClubTransferAd[]> {
  return apiFetch('/transfers/clubs');
}

export async function createPlayerTransferAd(
  token: string,
  data: { position: string; availableDays: string[]; aboutText: string },
): Promise<PlayerTransferAd> {
  return apiFetch('/transfers/players', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function closePlayerTransferAd(
  token: string,
  adId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/transfers/players/${adId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createClubTransferAd(
  token: string,
  teamId: string,
  data: { positionNeeded: string; requirementsText: string },
): Promise<ClubTransferAd> {
  return apiFetch(`/transfers/clubs/${teamId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function closeClubTransferAd(
  token: string,
  adId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/transfers/clubs/${adId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ContractItem {
  id: string;
  teamId: string;
  userId: string;
  durationMonths: number;
  buyoutFee: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  club: { id: string; name: string; tag: string; avatar: string | null };
  playerNickname: string | null;
  offeredByNickname: string | null;
}

export async function getMyContracts(token: string): Promise<ContractItem[]> {
  return apiFetch('/contracts/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTeamContracts(token: string, teamId: string): Promise<ContractItem[]> {
  return apiFetch(`/contracts/teams/${teamId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function offerContract(
  token: string,
  teamId: string,
  data: { nickname: string; durationMonths?: number; buyoutFee?: number },
): Promise<ContractItem> {
  return apiFetch(`/contracts/teams/${teamId}/offer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function acceptContract(token: string, contractId: string): Promise<ContractItem> {
  return apiFetch(`/contracts/${contractId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function declineContract(
  token: string,
  contractId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/contracts/${contractId}/decline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function buyoutContract(
  token: string,
  contractId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/contracts/${contractId}/buyout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Seasons ---

export type SeasonStatus = 'UPCOMING' | 'REGISTRATION' | 'ACTIVE' | 'FINISHED';
export type SeasonType = 'REGULAR' | 'OFFSEASON_FUN';

export interface SeasonDivision {
  id: string;
  name: string;
  label: string;
  groupLabel?: string;
  tierOrder: number;
}

export interface SeasonSummary {
  id: string;
  name: string;
  type: SeasonType;
  year: number;
  calendarSlot: string | null;
  calendarLabel: string | null;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  hasDivisions: boolean;
  isPublic?: boolean;
  entryFee: number;
  lanPointsWeight: number;
  entryCount: number;
  divisions: SeasonDivision[];
}

export interface PromotionRule {
  id: string;
  divisionId: string;
  divisionName: string;
  divisionLabel: string;
  promoteTopN: number;
  relegateBottomN: number;
}

export interface SeasonDetail extends SeasonSummary {
  promotionRules: PromotionRule[];
}

export interface SeasonStandingEntry {
  id: string;
  tablePosition: number | null;
  finalPosition: number | null;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  team: { id: string; name: string; tag: string; avatar: string | null };
  division: { id: string; name: string; label: string } | null;
}

export interface SeasonStandings {
  seasonId: string;
  hasDivisions: boolean;
  tables: {
    division: SeasonDivision | null;
    divisionLabel: string;
    entries: SeasonStandingEntry[];
  }[];
}

export interface LanPathResponse {
  year: number;
  calculated: boolean;
  qualifyTopN: number;
  message?: string;
  standings: {
    rank: number | null;
    team: { id: string; name: string; tag: string; avatar: string | null };
    totalPoints: number;
    seasonsPlayed: number;
    qualifiedForLan: boolean;
  }[];
}

export async function getSeasonCalendar() {
  return apiFetch<{ id: string; label: string; months: string }[]>('/seasons/calendar');
}

export async function getCurrentSeason(): Promise<SeasonSummary | null> {
  return apiFetch('/seasons/current');
}

export async function getSeasons(status?: SeasonStatus): Promise<SeasonSummary[]> {
  const q = status ? `?status=${status}` : '';
  return apiFetch(`/seasons${q}`);
}

export async function getSeason(id: string): Promise<SeasonDetail> {
  return apiFetch(`/seasons/${id}`);
}

export async function getSeasonStandings(
  id: string,
  divisionId?: string,
): Promise<SeasonStandings> {
  const q = divisionId ? `?divisionId=${divisionId}` : '';
  return apiFetch(`/seasons/${id}/standings${q}`);
}

export async function registerTeamForSeason(
  token: string,
  seasonId: string,
  teamId: string,
): Promise<SeasonStandingEntry> {
  return apiFetch(`/seasons/${seasonId}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ teamId }),
  });
}

export async function getLanPath(year?: number): Promise<LanPathResponse> {
  const q = year ? `?year=${year}` : '';
  return apiFetch(`/seasons/lan-path${q}`);
}

export async function getAdminSeasons(token: string): Promise<SeasonSummary[]> {
  return apiFetch('/admin/seasons', { headers: { Authorization: `Bearer ${token}` } });
}

export async function createAdminSeason(
  token: string,
  data: {
    name: string;
    type: SeasonType;
    year: number;
    calendarSlot?: string;
    startDate: string;
    endDate: string;
    status?: SeasonStatus;
    hasDivisions: boolean;
    entryFee?: number;
    lanPointsWeight?: number;
  },
): Promise<SeasonDetail> {
  return apiFetch('/admin/seasons', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateAdminSeason(
  token: string,
  id: string,
  data: Partial<{
    name: string;
    status: SeasonStatus;
    startDate: string;
    endDate: string;
    entryFee: number;
  }>,
): Promise<SeasonDetail> {
  return apiFetch(`/admin/seasons/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteAdminSeason(token: string, id: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/seasons/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setAdminPromotionRules(
  token: string,
  seasonId: string,
  rules: { divisionId: string; promoteTopN: number; relegateBottomN: number }[],
): Promise<SeasonDetail> {
  return apiFetch(`/admin/seasons/${seasonId}/promotion-rules`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rules }),
  });
}

export async function finishAdminSeason(token: string, seasonId: string): Promise<SeasonStandings> {
  return apiFetch(`/admin/seasons/${seasonId}/finish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateAdminSeasonEntry(
  token: string,
  seasonId: string,
  entryId: string,
  data: Partial<{
    points: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    matchesPlayed: number;
  }>,
): Promise<SeasonStandingEntry> {
  return apiFetch(`/admin/seasons/${seasonId}/entries/${entryId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function calculateAdminAnnual(
  token: string,
  year: number,
  qualifyTopN?: number,
): Promise<LanPathResponse> {
  return apiFetch('/admin/seasons/calculate-annual', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ year, qualifyTopN }),
  });
}

// --- Stats / XP ---

export interface PlayerMatchStatItem {
  id: string;
  position: string;
  positionLabel: string;
  passAccuracy: number;
  dribbles: number;
  tacklesWon: number;
  goals: number;
  assists: number;
  saves: number;
  interceptions: number;
  fouls: number;
  cleanSheet: boolean;
  xpEarned: number;
  enteredAt: string;
  match: {
    id: string;
    season: { id: string; name: string };
    score: string;
    homeTeam: { id: string; name: string; tag: string };
    awayTeam: { id: string; name: string; tag: string };
    division: string | null;
    playedAt: string | null;
  };
}

export interface PlayerCardProfile {
  userId: string;
  nickname: string;
  cardRating: number;
  eloRating: number;
  totwCount: number;
  currentSeasonXp: number;
  currentSeasonMatches: number;
  lastSeasonRecalc: {
    seasonName: string;
    baseRating: number;
    totwBonus: number;
    totsBonus: number;
    finalRating: number;
    calculatedAt: string;
  } | null;
}

export interface XpLeaderboardEntry {
  rank: number;
  userId: string;
  nickname?: string;
  avatar?: string | null;
  cardRating: number;
  totalXp: number;
  matchesPlayed: number;
  eligibleForRecalculation: boolean;
}

export interface StatTrackerMatch {
  id: string;
  season: { id: string; name: string };
  division: { id: string; name: string } | null;
  roundNumber: number;
  weekLabel: string | null;
  homeTeam: { id: string; name: string; tag: string };
  awayTeam: { id: string; name: string; tag: string };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  playedAt: string | null;
  statsCount: number;
}

function statTrackerHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getPlayerMatchStats(
  userId: string,
  limit = 50,
): Promise<PlayerMatchStatItem[]> {
  return apiFetch(`/stats/players/${userId}/matches?limit=${limit}`);
}

export async function getPlayerCardProfile(userId: string): Promise<PlayerCardProfile> {
  return apiFetch(`/stats/players/${userId}/card`);
}

export async function getSeasonXpLeaderboard(seasonId: string): Promise<XpLeaderboardEntry[]> {
  return apiFetch(`/stats/seasons/${seasonId}/xp-leaderboard`);
}

export type SeasonMatchSummary = StatTrackerMatch;

export type EaMatchPlayerStat = {
  playerName: string;
  userId: string | null;
  pitchzoneLinked: boolean;
  position: string;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  passAttempts: number;
  passesMade: number;
  passAccuracy: number;
  tackleAttempts: number;
  tacklesMade: number;
  saves: number;
  ballDiveSaves: number;
  crossSaves: number;
  goodDirectionSaves: number;
  parrySaves: number;
  punchSaves: number;
  reflexSaves: number;
  goalsConceded: number;
  cleanSheetAny: boolean;
  cleanSheetDef: boolean;
  cleanSheetGk: boolean;
  redCards: number;
  minutesPlayed: number;
  manOfTheMatch: boolean;
  vproAttr: string | null;
  xpEarned: number | null;
};

export type SeasonMatchDetail = {
  id: string;
  season: { id: string; name: string; status: string };
  division: { id: string; name: string } | null;
  roundNumber: number;
  weekLabel: string | null;
  homeTeam: { id: string; name: string; tag: string };
  awayTeam: { id: string; name: string; tag: string };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  playedAt: string | null;
  eaMatchId: string | null;
  statsCount: number;
  homeEaPlayers: EaMatchPlayerStat[];
  awayEaPlayers: EaMatchPlayerStat[];
};

export async function getSeasonMatches(seasonId: string): Promise<SeasonMatchSummary[]> {
  return apiFetch(`/stats/seasons/${seasonId}/matches`);
}

export async function getSeasonMatchDetail(matchId: string): Promise<SeasonMatchDetail> {
  return apiFetch(`/stats/matches/${matchId}`);
}

export async function getStatTrackerMatches(
  token: string,
  seasonId?: string,
): Promise<StatTrackerMatch[]> {
  const q = seasonId ? `?seasonId=${seasonId}` : '';
  return apiFetch(`/stat-tracker/season-matches${q}`, { headers: statTrackerHeaders(token) });
}

export async function createSeasonMatch(
  token: string,
  data: {
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
    weekLabel?: string;
    roundNumber?: number;
    divisionId?: string;
  },
): Promise<StatTrackerMatch> {
  return apiFetch('/stat-tracker/season-matches', {
    method: 'POST',
    headers: statTrackerHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function completeSeasonMatch(
  token: string,
  matchId: string,
  data: { homeScore: number; awayScore: number },
): Promise<unknown> {
  return apiFetch(`/stat-tracker/season-matches/${matchId}/complete`, {
    method: 'PATCH',
    headers: statTrackerHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function submitMatchStats(
  token: string,
  matchId: string,
  data: {
    players: {
      userId: string;
      positionPlayed: string;
      passAccuracy: number;
      dribbles: number;
      tacklesWon: number;
      goals: number;
      assists: number;
      saves?: number;
      interceptions?: number;
      fouls?: number;
      cleanSheet?: boolean;
    }[];
  },
): Promise<{ id: string; userId: string; xpEarned: number }[]> {
  return apiFetch(`/stat-tracker/season-matches/${matchId}/stats`, {
    method: 'POST',
    headers: statTrackerHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function recalculateSeasonRatings(
  token: string,
  seasonId: string,
): Promise<{ seasonId: string; playersProcessed: number; eligibleCount: number }> {
  return apiFetch('/stat-tracker/seasons/recalculate-ratings', {
    method: 'POST',
    headers: statTrackerHeaders(token),
    body: JSON.stringify({ seasonId }),
  });
}

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
}

export interface OnboardingProgress {
  steps: {
    register: { completed: boolean };
    profile: { completed: boolean };
    pickup: { completed: boolean; pickupCount: number };
    transfers: { completed: boolean; hasTeam: boolean };
  };
  allComplete: boolean;
  profile: {
    gamerTag: string | null;
    gamerTagConfirmed: boolean;
    primaryPosition: string | null;
    countryCode: string | null;
    city: string | null;
  } | null;
  nextStep: 'profile' | 'pickup' | 'transfers' | null;
}

export interface PickupMatchItem {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  maxPlayers: number;
  registeredCount: number;
  platform: string | null;
  chatUrl: string | null;
  status: string;
  createdByNickname?: string;
  isRegistered: boolean;
  registrations: {
    userId: string;
    nickname?: string;
    gamerTag?: string | null;
    position?: string | null;
  }[];
}

export async function getOnboardingSteps(): Promise<OnboardingStep[]> {
  return apiFetch('/onboarding/steps');
}

export async function getOnboardingProgress(token: string): Promise<OnboardingProgress> {
  return apiFetch('/onboarding/me', { headers: { Authorization: `Bearer ${token}` } });
}

export async function completeOnboardingProfile(
  token: string,
  data: {
    gamerTag: string;
    gamerTagConfirmed: boolean;
    primaryPosition: string;
    country?: string;
    countryCode?: string;
    city?: string;
    vkUrl?: string;
    telegramUrl?: string;
    discordUsername?: string;
  },
): Promise<{
  success: boolean;
  gamerTag: string;
  warnings: string[];
  progress: OnboardingProgress;
}> {
  return apiFetch('/onboarding/me/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function markTransfersVisited(token: string): Promise<OnboardingProgress> {
  return apiFetch('/onboarding/me/transfers-visited', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getPickupMatches(token?: string): Promise<PickupMatchItem[]> {
  return apiFetch('/onboarding/pickup-matches', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function registerPickupMatch(
  token: string,
  matchId: string,
  data?: { position?: string },
): Promise<OnboardingProgress> {
  return apiFetch(`/onboarding/pickup-matches/${matchId}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data ?? {}),
  });
}

export async function leavePickupMatch(
  token: string,
  matchId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/onboarding/pickup-matches/${matchId}/register`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createPickupMatch(
  token: string,
  data: {
    title: string;
    description?: string;
    scheduledAt: string;
    maxPlayers?: number;
    platform?: string;
    chatUrl?: string;
  },
): Promise<PickupMatchItem> {
  return apiFetch('/onboarding/pickup-matches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface PlayerProfileOverview {
  player: {
    id: string;
    nickname: string;
    avatar: string | null;
    gamerTag: string | null;
    country: string | null;
    countryCode: string | null;
    city: string | null;
    bio: string | null;
    primaryPosition: string | null;
    primaryPositionLabel: string | null;
    secondaryPositions: string[];
    fullName: string | null;
    birthDate: string | null;
    premiumUntil: string | null;
    joinedAt: string;
    socialLinks: { vk: string | null; telegram: string | null; discord: string | null };
  };
  card: {
    rating: number;
    position: string | null;
    positionLabel: string;
    attributes: {
      attack: number;
      passing: number;
      dribbling: number;
      creation: number;
      defense: number;
      physical: number;
    };
    currentTeam: { id: string; name: string; tag: string; avatar: string | null } | null;
  };
  contract: {
    team: { id: string; name: string; tag: string; avatar: string | null };
    status: string;
    role: string;
    endDate: string | null;
    isIndefinite: boolean;
    buyoutFee: number | null;
    contractId: string | null;
  } | null;
  career: {
    totalMatches: number;
    totalXp: number;
    avgMatchRating: number;
    goals: number;
    assists: number;
    passAccuracyPercent: number;
    successfulTackles: number;
    interceptions: number;
    cleanSheets: number;
    ranks: Record<string, number | null | undefined>;
  } | null;
  favoritePositions: {
    group: string;
    label: string;
    matchesPlayed: number;
    percentOfTotal: number;
  }[];
  positionRatings: {
    position: string;
    positionLabel: string;
    positionGroup: string;
    positionGroupLabel: string;
    matchesPlayed: number;
    percentOfTotal: number;
    avgMatchRating: number;
  }[];
  pinnedAwards: {
    id: string;
    name: string;
    description: string;
    category: string;
    iconEmoji: string;
    awardedForText: string;
    awardedAt: string;
  }[];
  gamertagHistory: {
    gamerTag: string;
    validFrom: string;
    validTo: string | null;
    isCurrent: boolean;
  }[];
}

export interface PlayerProfileStatistics {
  tab: string;
  position: string | null;
  category: string;
  rows: Record<string, unknown>[];
}

export interface PlayerTransferEntry {
  team: { id: string; name: string; tag: string; avatar: string | null };
  matchesPlayed: number;
  avgMatchRating: number;
  captainStarRating: number | null;
  joinedAt: string;
  leftAt: string | null;
  isCurrent: boolean;
  daysInClub: number;
  role: string;
}

export interface PlayerAwardItem {
  id: string;
  awardId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  awardedForText: string;
  awardedAt: string;
  isPinned: boolean;
}

export async function getPlayerProfileOverview(userId: string): Promise<PlayerProfileOverview> {
  return apiFetch(`/player-profile/${userId}/overview`);
}

export async function getPlayerProfileStatistics(
  userId: string,
  params?: { tab?: string; position?: string; category?: string },
): Promise<PlayerProfileStatistics> {
  const q = new URLSearchParams();
  if (params?.tab) q.set('tab', params.tab);
  if (params?.position) q.set('position', params.position);
  if (params?.category) q.set('category', params.category);
  const suffix = q.toString() ? `?${q}` : '';
  return apiFetch(`/player-profile/${userId}/statistics${suffix}`);
}

export async function getPlayerProfileTransfers(userId: string): Promise<PlayerTransferEntry[]> {
  return apiFetch(`/player-profile/${userId}/transfers`);
}

export async function getPlayerProfileAwards(
  userId: string,
  category?: string,
): Promise<PlayerAwardItem[]> {
  const suffix = category ? `?category=${category}` : '';
  return apiFetch(`/player-profile/${userId}/awards${suffix}`);
}

export async function pinPlayerAward(
  token: string,
  userAwardId: string,
  pinned: boolean,
): Promise<unknown> {
  return apiFetch(`/player-profile/me/awards/${userAwardId}/pin`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pinned }),
  });
}

export type EaClubPlatform = 'PS' | 'XBOX' | 'PC';

export interface EaClubLink {
  id: string;
  teamId: string;
  eaClubId: string;
  platform: EaClubPlatform;
  gameVersion: string;
  lastVerifiedClubName: string | null;
  needsReverification: boolean;
  lastPolledAt: string | null;
  lastSyncedMatchEaId: string | null;
}

export async function getEaClubLink(teamId: string): Promise<EaClubLink | null> {
  return apiFetch(`/ea-sync/clubs/${teamId}/link`);
}

export async function updateEaClubLink(
  token: string,
  teamId: string,
  data: { eaClubId: string; platform: EaClubPlatform },
): Promise<EaClubLink> {
  return apiFetch(`/ea-sync/clubs/${teamId}/link`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface EaSyncStatus {
  linkedClubsCount: number;
  lastPolledAt: string | null;
  lastImportAt: string | null;
  importCounts: { imported: number; needsReview: number; discarded: number };
  workerNote: string;
  links: {
    teamId: string;
    teamTag: string;
    teamName: string;
    eaClubId: string;
    platform: string;
    lastPolledAt: string | null;
    lastSyncedMatchEaId: string | null;
  }[];
}

export interface EaSyncImportItem {
  id: string;
  eaMatchId: string;
  importStatus: string;
  reviewNote: string | null;
  importedAt: string;
  teamTag: string;
  teamName: string;
  matchedSeasonMatch: {
    id: string;
    homeTeam: { tag: string };
    awayTeam: { tag: string };
  } | null;
}

export interface EaSyncPollResult {
  linksPolled: number;
  newMatches: number;
  imported: number;
  needsReview: number;
  skipped: number;
  errors: string[];
}

function mapEaImportItem(raw: {
  id: string;
  eaMatchId: string;
  importStatus: string;
  reviewNote: string | null;
  importedAt: string;
  eaClubLink: { team: { tag: string; name: string } };
  matchedSeasonMatch: {
    id: string;
    homeTeam: { tag: string };
    awayTeam: { tag: string };
  } | null;
}): EaSyncImportItem {
  return {
    id: raw.id,
    eaMatchId: raw.eaMatchId,
    importStatus: raw.importStatus,
    reviewNote: raw.reviewNote,
    importedAt: raw.importedAt,
    teamTag: raw.eaClubLink.team.tag,
    teamName: raw.eaClubLink.team.name,
    matchedSeasonMatch: raw.matchedSeasonMatch,
  };
}

export async function getEaSyncStatus(token: string): Promise<EaSyncStatus> {
  return apiFetch('/ea-sync/status', { headers: { Authorization: `Bearer ${token}` } });
}

export async function getEaSyncImports(token: string): Promise<EaSyncImportItem[]> {
  const rows = await apiFetch<
    {
      id: string;
      eaMatchId: string;
      importStatus: string;
      reviewNote: string | null;
      importedAt: string;
      eaClubLink: { team: { tag: string; name: string } };
      matchedSeasonMatch: {
        id: string;
        homeTeam: { tag: string };
        awayTeam: { tag: string };
      } | null;
    }[]
  >('/ea-sync/imports', { headers: { Authorization: `Bearer ${token}` } });
  return rows.map(mapEaImportItem);
}

export async function triggerEaSyncPoll(token: string): Promise<EaSyncPollResult> {
  return apiFetch('/ea-sync/poll', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function triggerEaSyncPollTeam(
  token: string,
  teamId: string,
): Promise<EaSyncPollResult> {
  return apiFetch(`/ea-sync/poll/${teamId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(
  token: string,
  unreadOnly = false,
): Promise<NotificationItem[]> {
  return apiFetch(`/notifications${unreadOnly ? '?unread=true' : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  return apiFetch('/notifications/unread-count', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markNotificationRead(token: string, id: string): Promise<NotificationItem> {
  return apiFetch(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  return apiFetch('/notifications/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
