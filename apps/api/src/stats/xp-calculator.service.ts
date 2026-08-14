import { Injectable } from '@nestjs/common';
import { DivisionTier, PlayerPosition } from '@prisma/client';

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface MatchStatInput {
  passAccuracy: number;
  dribbles: number;
  tacklesWon: number;
  goals: number;
  assists: number;
  saves?: number;
  interceptions?: number;
  fouls?: number;
  cleanSheet?: boolean;
}

const DIVISION_MULTIPLIERS: Record<DivisionTier, number> = {
  GOLD: 1.3,
  SILVER: 1.15,
  BRONZE: 1.0,
  NONE: 1.05,
};

const WEIGHTS: Record<
  PositionGroup,
  {
    passAccuracy: number;
    dribbles: number;
    tacklesWon: number;
    goals: number;
    assists: number;
    saves: number;
    interceptions: number;
    cleanSheet: number;
    fouls: number;
  }
> = {
  GK: {
    passAccuracy: 0.25,
    dribbles: 0.5,
    tacklesWon: 2,
    goals: 6,
    assists: 3,
    saves: 8,
    interceptions: 2,
    cleanSheet: 25,
    fouls: -2,
  },
  DEF: {
    passAccuracy: 0.2,
    dribbles: 2,
    tacklesWon: 6,
    goals: 8,
    assists: 5,
    saves: 0,
    interceptions: 5,
    cleanSheet: 12,
    fouls: -2,
  },
  MID: {
    passAccuracy: 0.35,
    dribbles: 4,
    tacklesWon: 3,
    goals: 9,
    assists: 10,
    saves: 0,
    interceptions: 2,
    cleanSheet: 0,
    fouls: -2,
  },
  FWD: {
    passAccuracy: 0.12,
    dribbles: 5,
    tacklesWon: 1,
    goals: 15,
    assists: 8,
    saves: 0,
    interceptions: 0,
    cleanSheet: 0,
    fouls: -2,
  },
};

@Injectable()
export class XpCalculatorService {
  getPositionGroup(position: PlayerPosition): PositionGroup {
    switch (position) {
      case PlayerPosition.GK:
        return 'GK';
      case PlayerPosition.CB:
      case PlayerPosition.LB:
      case PlayerPosition.RB:
        return 'DEF';
      case PlayerPosition.CDM:
      case PlayerPosition.CM:
      case PlayerPosition.CAM:
      case PlayerPosition.LM:
      case PlayerPosition.RM:
        return 'MID';
      default:
        return 'FWD';
    }
  }

  getDivisionMultiplier(tier: DivisionTier | null | undefined): number {
    return DIVISION_MULTIPLIERS[tier ?? DivisionTier.NONE];
  }

  calculateXp(position: PlayerPosition, stats: MatchStatInput, divisionTier?: DivisionTier | null): number {
    const group = this.getPositionGroup(position);
    const w = WEIGHTS[group];

    let xp = 12;
    xp += stats.passAccuracy * w.passAccuracy;
    xp += stats.dribbles * w.dribbles;
    xp += stats.tacklesWon * w.tacklesWon;
    xp += stats.goals * w.goals;
    xp += stats.assists * w.assists;
    xp += (stats.saves ?? 0) * w.saves;
    xp += (stats.interceptions ?? 0) * w.interceptions;
    xp += (stats.fouls ?? 0) * w.fouls;
    if (stats.cleanSheet) xp += w.cleanSheet;

    const multiplier = this.getDivisionMultiplier(divisionTier);
    return Math.max(0, Math.round(xp * multiplier));
  }
}
