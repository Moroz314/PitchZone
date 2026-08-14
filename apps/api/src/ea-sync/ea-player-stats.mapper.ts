/** Полная статистика игрока из EA Pro Clubs API (как в FIFA). */
export interface EaFifaPlayerStats {
  playerName: string;
  position: string;
  archetypeId: string;
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
  secondsPlayed: number;
  minutesPlayed: number;
  manOfTheMatch: boolean;
  vproAttr: string | null;
}

type EaRawPlayer = Record<string, string | undefined>;

function num(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function passAccuracyPercent(made: number, attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.round((made / attempts) * 1000) / 10;
}

export function parseEaRawPlayer(raw: EaRawPlayer): EaFifaPlayerStats | null {
  const playerName = raw.playername?.trim();
  if (!playerName) return null;

  const passAttempts = num(raw.passattempts);
  const passesMade = num(raw.passesmade);
  const secondsPlayed = num(raw.secondsPlayed) || num(raw.gameTime);

  return {
    playerName,
    position: raw.pos ?? '—',
    archetypeId: raw.archetypeid ?? '',
    rating: num(raw.rating),
    goals: num(raw.goals),
    assists: num(raw.assists),
    shots: num(raw.shots),
    passAttempts,
    passesMade,
    passAccuracy: passAccuracyPercent(passesMade, passAttempts),
    tackleAttempts: num(raw.tackleattempts),
    tacklesMade: num(raw.tacklesmade),
    saves: num(raw.saves),
    ballDiveSaves: num(raw.ballDiveSaves),
    crossSaves: num(raw.crossSaves),
    goodDirectionSaves: num(raw.goodDirectionSaves),
    parrySaves: num(raw.parrySaves),
    punchSaves: num(raw.punchSaves),
    reflexSaves: num(raw.reflexSaves),
    goalsConceded: num(raw.goalsconceded),
    cleanSheetAny: num(raw.cleansheetsany) > 0,
    cleanSheetDef: num(raw.cleansheetsdef) > 0,
    cleanSheetGk: num(raw.cleansheetsgk) > 0,
    redCards: num(raw.redcards),
    secondsPlayed,
    minutesPlayed: Math.round(secondsPlayed / 60),
    manOfTheMatch: num(raw.mom) > 0,
    vproAttr: raw.vproattr ?? null,
  };
}

export function parseEaClubPlayersFromMatchRaw(
  matchRaw: unknown,
  eaClubId: string,
): EaFifaPlayerStats[] {
  const row = matchRaw as { players?: Record<string, Record<string, EaRawPlayer>> };
  if (!row.players) return [];

  const clubPlayers =
    row.players[eaClubId] ?? row.players[String(eaClubId)] ?? row.players[Number(eaClubId) as unknown as string];
  if (!clubPlayers) return [];

  return Object.values(clubPlayers)
    .map((p) => parseEaRawPlayer(p))
    .filter((p): p is EaFifaPlayerStats => p !== null)
    .sort((a, b) => b.rating - a.rating || b.goals - a.goals);
}

export function eaFifaStatsToOtherMetrics(stats: EaFifaPlayerStats): Record<string, unknown> {
  return { ...stats, source: 'ea_pro_clubs' };
}
