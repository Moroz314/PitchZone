import { Injectable, Logger } from '@nestjs/common';
import { EaClubPlatform } from '@prisma/client';

import {
  EaClubMatchSummary,
  EaPlayerMatchStat,
  StatsProvider,
} from './stats-provider.interface';
import { parseEaRawPlayer, eaFifaStatsToOtherMetrics } from '../ea-player-stats.mapper';

const EA_BASE = 'https://proclubs.ea.com/api/fc';

const PLATFORM_SLUG: Record<EaClubPlatform, string> = {
  PS: 'common-gen5',
  XBOX: 'common-gen5',
  PC: 'common-gen5',
};

const MATCH_TYPES = ['leagueMatch', 'playoffMatch', 'friendlyMatch'] as const;

type EaMatchClub = {
  clubId?: number;
  goals?: string;
  goalsAgainst?: string;
  matchType?: string;
};

type EaMatchPlayer = Record<string, string | undefined>;

type EaMatchJson = {
  matchId?: string;
  timestamp?: number;
  clubs?: Record<string, EaMatchClub & { details?: { clubId?: number } }>;
  players?: Record<string, Record<string, EaMatchPlayer>>;
};

@Injectable()
export class EaProClubsStatsProvider implements StatsProvider {
  private readonly logger = new Logger(EaProClubsStatsProvider.name);

  async fetchClubMatches(
    eaClubId: string,
    platform: EaClubPlatform,
  ): Promise<EaClubMatchSummary[]> {
    const platformSlug = PLATFORM_SLUG[platform];
    const all: EaClubMatchSummary[] = [];

    for (const matchType of MATCH_TYPES) {
      const batch = await this.requestMatches(eaClubId, platformSlug, matchType);
      all.push(...batch);
    }

    const byId = new Map<string, EaClubMatchSummary>();
    for (const m of all) {
      byId.set(m.matchId, m);
    }

    return [...byId.values()].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async fetchMatchPlayerStats(
    matchId: string,
    eaClubId: string,
    platform: EaClubPlatform,
  ): Promise<EaPlayerMatchStat[]> {
    const matches = await this.fetchClubMatches(eaClubId, platform);
    const match = matches.find((m) => m.matchId === matchId);
    if (!match) {
      this.logger.warn(`EA match ${matchId} not found in recent history for club ${eaClubId}`);
      return [];
    }

    return this.parsePlayersFromRaw(match.raw as EaMatchJson, eaClubId);
  }

  private async requestMatches(
    eaClubId: string,
    platformSlug: string,
    matchType: string,
  ): Promise<EaClubMatchSummary[]> {
    const url = new URL(`${EA_BASE}/clubs/matches`);
    url.searchParams.set('platform', platformSlug);
    url.searchParams.set('clubIds', eaClubId);
    url.searchParams.set('matchType', matchType);
    url.searchParams.set('maxResultCount', '20');

    const json = await this.getJson<EaMatchJson[]>(url.toString());
    if (!Array.isArray(json)) return [];

    return json
      .map((row) => this.normalizeMatch(row))
      .filter((m): m is EaClubMatchSummary => m !== null);
  }

  private normalizeMatch(row: EaMatchJson): EaClubMatchSummary | null {
    if (!row.matchId || !row.timestamp || !row.clubs) return null;

    const clubEntries = Object.entries(row.clubs);
    if (clubEntries.length < 2) return null;

    const [homeId, homeClub] = clubEntries[0];
    const [awayId, awayClub] = clubEntries[1];

    return {
      matchId: String(row.matchId),
      timestamp: new Date(row.timestamp * 1000),
      matchType: homeClub.matchType ?? 'unknown',
      homeEaClubId: String(homeClub.details?.clubId ?? homeClub.clubId ?? homeId),
      awayEaClubId: String(awayClub.details?.clubId ?? awayClub.clubId ?? awayId),
      homeScore: Number(homeClub.goals ?? 0),
      awayScore: Number(homeClub.goalsAgainst ?? awayClub.goals ?? 0),
      raw: row,
    };
  }

  parsePlayersFromRaw(row: EaMatchJson, eaClubId: string): EaPlayerMatchStat[] {
    if (!row.players) return [];

    const clubPlayers = row.players[eaClubId] ?? row.players[String(eaClubId)];
    if (!clubPlayers) {
      const firstKey = Object.keys(row.players)[0];
      if (!firstKey) return [];
      return this.mapPlayers(row.players[firstKey]);
    }

    return this.mapPlayers(clubPlayers);
  }

  private mapPlayers(players: Record<string, EaMatchPlayer>): EaPlayerMatchStat[] {
    const result: EaPlayerMatchStat[] = [];

    for (const p of Object.values(players)) {
      const parsed = parseEaRawPlayer(p);
      if (!parsed) continue;

      result.push({
        playerName: parsed.playerName,
        positionCode: parsed.position,
        goals: parsed.goals,
        assists: parsed.assists,
        passAttempts: parsed.passAttempts,
        passesMade: parsed.passesMade,
        tacklesMade: parsed.tacklesMade,
        tackleAttempts: parsed.tackleAttempts,
        saves: parsed.saves,
        interceptions: 0,
        fouls: 0,
        cleanSheet: parsed.cleanSheetAny || parsed.cleanSheetDef || parsed.cleanSheetGk,
        rating: parsed.rating,
        shots: parsed.shots,
        goalsConceded: parsed.goalsConceded,
        redCards: parsed.redCards,
        manOfTheMatch: parsed.manOfTheMatch,
        eaMetrics: eaFifaStatsToOtherMetrics(parsed),
      });
    }

    return result;
  }

  private async getJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        this.logger.warn(`EA API ${res.status} for ${url}`);
        return null;
      }

      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`EA API request failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
