import Link from 'next/link';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import type { EaMatchPlayerStat } from '@/lib/api';

function posLabel(pos: string) {
  const map: Record<string, string> = {
    goalkeeper: 'ВР',
    defender: 'ЗЩ',
    midfielder: 'ПЗ',
    forward: 'НП',
  };
  return map[pos.toLowerCase()] ?? pos;
}

export function EaMatchPlayersTable({
  teamTag,
  teamName,
  players,
}: {
  teamTag: string;
  teamName: string;
  players: EaMatchPlayerStat[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          [{teamTag}] {teamName}
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            {players.length} игроков · EA FC
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {players.length === 0 ? (
          <p className="text-muted-foreground px-6 py-8 text-sm">
            Статистика из EA пока не загружена
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-card sticky left-0">Игрок</TableHead>
                <TableHead>Поз</TableHead>
                <TableHead className="text-center">Рейт</TableHead>
                <TableHead className="text-center">Мин</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">A</TableHead>
                <TableHead className="text-center">Удары</TableHead>
                <TableHead className="text-center">Пасы</TableHead>
                <TableHead className="text-center">Пас%</TableHead>
                <TableHead className="text-center">Отборы</TableHead>
                <TableHead className="text-center">Сейвы</TableHead>
                <TableHead className="text-center">Проп</TableHead>
                <TableHead className="text-center">КК</TableHead>
                <TableHead className="text-center">CS</TableHead>
                <TableHead className="text-center">MVP</TableHead>
                <TableHead className="text-right">XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p) => (
                <TableRow
                  key={p.playerName}
                  className={p.manOfTheMatch ? 'bg-accent/5' : undefined}
                >
                  <TableCell className="bg-card sticky left-0">
                    {p.userId ? (
                      <Link href={`/players/${p.userId}`} className="hover:text-accent font-medium">
                        {p.playerName}
                      </Link>
                    ) : (
                      <span className="font-medium">{p.playerName}</span>
                    )}
                    {!p.pitchzoneLinked && (
                      <span className="text-muted-foreground ml-1 text-xs">(EA)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{posLabel(p.position)}</TableCell>
                  <TableCell className="text-accent text-center font-mono font-semibold">
                    {p.rating.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center font-mono">{p.minutesPlayed}</TableCell>
                  <TableCell className="text-center font-mono">{p.goals}</TableCell>
                  <TableCell className="text-center font-mono">{p.assists}</TableCell>
                  <TableCell className="text-center font-mono">{p.shots}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {p.passesMade}/{p.passAttempts}
                  </TableCell>
                  <TableCell className="text-center font-mono">{p.passAccuracy}%</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {p.tacklesMade}/{p.tackleAttempts}
                  </TableCell>
                  <TableCell className="text-center font-mono">{p.saves || '—'}</TableCell>
                  <TableCell className="text-center font-mono">{p.goalsConceded || '—'}</TableCell>
                  <TableCell className="text-center font-mono">{p.redCards || '—'}</TableCell>
                  <TableCell className="text-center">
                    {p.cleanSheetAny || p.cleanSheetDef || p.cleanSheetGk ? '✓' : '—'}
                  </TableCell>
                  <TableCell className="text-center">{p.manOfTheMatch ? '★' : '—'}</TableCell>
                  <TableCell className="text-accent text-right font-mono">
                    {p.xpEarned ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {players.some((p) => p.saves > 0) && (
          <p className="border-border/50 text-muted-foreground border-t px-4 py-2 text-xs">
            Сейвы вратаря (EA): нырки {players.reduce((s, p) => s + p.ballDiveSaves, 0)} · кроссы{' '}
            {players.reduce((s, p) => s + p.crossSaves, 0)} · парирования{' '}
            {players.reduce((s, p) => s + p.parrySaves, 0)} · рефлексы{' '}
            {players.reduce((s, p) => s + p.reflexSaves, 0)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
