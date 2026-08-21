import { EaClubPlatform } from '@prisma/client';

export interface EaClubMatchSummary {
  matchId: string;
  timestamp: Date;
  matchType: string;
  homeEaClubId: string;
  awayEaClubId: string;
  homeScore: number;
  awayScore: number;
  raw: unknown;
}

export interface EaPlayerMatchStat {
  playerName: string;
  positionCode: string;
  goals: number;
  assists: number;
  passAttempts: number;
  passesMade: number;
  tacklesMade: number;
  tackleAttempts: number;
  saves: number;
  interceptions: number;
  fouls: number;
  cleanSheet: boolean;
  rating: number;
  shots: number;
  goalsConceded: number;
  redCards: number;
  manOfTheMatch: boolean;
  eaMetrics: Record<string, unknown>;
}

export interface StatsProvider {
  fetchClubMatches(
    eaClubId: string,
    platform: EaClubPlatform,
  ): Promise<EaClubMatchSummary[]>;

  fetchMatchPlayerStats(
    matchId: string,
    eaClubId: string,
    platform: EaClubPlatform,
  ): Promise<EaPlayerMatchStat[]>;

  verifyClub(
    eaClubId: string,
    platform: EaClubPlatform,
  ): Promise<{ id: string; name: string } | null>;
}

export const STATS_PROVIDER = Symbol('STATS_PROVIDER');
