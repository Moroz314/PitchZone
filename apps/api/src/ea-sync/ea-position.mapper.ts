import { PlayerPosition } from '@prisma/client';

const EA_POS_MAP: Record<string, PlayerPosition> = {
  '0': PlayerPosition.GK,
  '1': PlayerPosition.RB,
  '2': PlayerPosition.RB,
  '3': PlayerPosition.LB,
  '4': PlayerPosition.CB,
  '5': PlayerPosition.CB,
  '6': PlayerPosition.CDM,
  '7': PlayerPosition.CM,
  '8': PlayerPosition.CAM,
  '9': PlayerPosition.LM,
  '10': PlayerPosition.RM,
  '11': PlayerPosition.LW,
  '12': PlayerPosition.RW,
  '13': PlayerPosition.ST,
  '14': PlayerPosition.CF,
  goalkeeper: PlayerPosition.GK,
  defender: PlayerPosition.CB,
  midfielder: PlayerPosition.CM,
  forward: PlayerPosition.ST,
};

export function mapEaPosition(code: string): PlayerPosition {
  const key = code.trim().toLowerCase();
  return EA_POS_MAP[key] ?? EA_POS_MAP[code] ?? PlayerPosition.CM;
}

export function passAccuracyPercent(passesMade: number, passAttempts: number): number {
  if (passAttempts <= 0) return 0;
  return Math.round((passesMade / passAttempts) * 1000) / 10;
}
