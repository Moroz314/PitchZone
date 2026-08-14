'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@pitchzone/ui';

import { type TournamentDetail } from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

interface TournamentResultsProps {
  tournament: TournamentDetail;
}

export function TournamentResults({ tournament }: TournamentResultsProps) {
  if (tournament.status !== 'finished' || !tournament.results) {
    return null;
  }

  const { standings, totalPaid, escrowStatus } = tournament.results;

  if (standings.length === 0) return null;

  return (
    <Card className="mb-6 border-accent/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Итоги турнира</CardTitle>
          <Badge variant="success">Завершён</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Призовые выплачены на кошельки победителей
          {escrowStatus === 'DISTRIBUTED' && ' · эскроу закрыт'}.
          Всего распределено:{' '}
          <span className="font-mono text-accent">{formatCurrency(totalPaid)}</span>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Место</TableHead>
              <TableHead>Участник</TableHead>
              <TableHead className="text-right">Призовые</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((row) => (
              <TableRow key={row.participantId}>
                <TableCell className="font-mono">{row.place}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right font-mono text-accent">
                  {row.prizeAmount > 0 ? formatCurrency(row.prizeAmount) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
