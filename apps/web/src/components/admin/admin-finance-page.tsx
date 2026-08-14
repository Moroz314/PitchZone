'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Button,
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

import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminCompleteWithdrawal,
  adminFailWithdrawal,
  getAdminFinanceSummary,
  getAdminTransactions,
  getAdminWithdrawals,
  type AdminFinanceSummary,
  type AdminTransaction,
  type AdminWithdrawal,
} from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

const TX_LABELS: Record<string, string> = {
  DEPOSIT: 'Пополнение',
  ENTRY_FEE_HOLD: 'Взнос',
  ENTRY_FEE_REFUND: 'Возврат',
  PRIZE_PAYOUT: 'Призовые',
  PLATFORM_COMMISSION: 'Комиссия',
  WITHDRAWAL: 'Вывод',
};

export function AdminFinancePage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<AdminFinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [txFilter, setTxFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const [fin, tx, wd] = await Promise.all([
        getAdminFinanceSummary(session.accessToken),
        getAdminTransactions(session.accessToken, txFilter ? { type: txFilter } : undefined),
        getAdminWithdrawals(session.accessToken, 'PENDING'),
      ]);
      setSummary(fin);
      setTransactions(tx.items);
      setWithdrawals(wd);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, txFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleWithdrawal(id: string, action: 'complete' | 'fail') {
    if (!session?.accessToken) return;
    setActionId(id);
    try {
      if (action === 'complete') {
        await adminCompleteWithdrawal(session.accessToken, id);
      } else {
        await adminFailWithdrawal(session.accessToken, id, 'Отклонено администратором');
      }
      await load();
      setMessage(
        action === 'complete' ? 'Вывод подтверждён' : 'Вывод отклонён, средства возвращены',
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionId(null);
    }
  }

  return (
    <AdminShell>
      {message && <p className="text-accent mb-4 text-sm">{message}</p>}

      {loading || !summary ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Комиссия платформы"
              value={formatCurrency(summary.platformCommissionTotal)}
            />
            <StatCard title="Взносы (hold)" value={formatCurrency(summary.entryFeesHeld)} />
            <StatCard title="Выплачено призовых" value={formatCurrency(summary.prizesPaid)} />
            <StatCard title="В эскроу (счета)" value={String(summary.escrowAccounts.length)} />
          </div>

          {withdrawals.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Выводы в обработке ({withdrawals.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Способ</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{w.user.nickname}</TableCell>
                        <TableCell className="font-mono">{formatCurrency(w.amount)}</TableCell>
                        <TableCell>{w.method ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              disabled={actionId === w.id}
                              onClick={() => handleWithdrawal(w.id, 'complete')}
                            >
                              Подтвердить
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionId === w.id}
                              onClick={() => handleWithdrawal(w.id, 'fail')}
                            >
                              Отклонить
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Эскроу-счета</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Турнир</TableHead>
                    <TableHead>Статус турнира</TableHead>
                    <TableHead>Удержано</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.escrowAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>Нет активных эскроу</TableCell>
                    </TableRow>
                  ) : (
                    summary.escrowAccounts.map((e) => (
                      <TableRow key={e.tournamentId}>
                        <TableCell>
                          <Link href={`/tournaments/${e.slug}`} className="hover:text-accent">
                            {e.title}
                          </Link>
                        </TableCell>
                        <TableCell>{e.tournamentStatus}</TableCell>
                        <TableCell className="font-mono">{formatCurrency(e.totalHeld)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle>Транзакции</CardTitle>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={txFilter}
                onChange={(e) => setTxFilter(e.target.value)}
              >
                <option value="">Все типы</option>
                {Object.entries(TX_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Турнир</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{TX_LABELS[tx.type] ?? tx.type}</TableCell>
                      <TableCell>{tx.user.nickname}</TableCell>
                      <TableCell>
                        {tx.tournament ? (
                          <Link
                            href={`/tournaments/${tx.tournament.slug}`}
                            className="text-accent hover:underline"
                          >
                            {tx.tournament.title}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={tx.status === 'COMPLETED' ? 'success' : 'secondary'}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString('ru-RU')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </AdminShell>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{title}</p>
        <p className="font-display text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
