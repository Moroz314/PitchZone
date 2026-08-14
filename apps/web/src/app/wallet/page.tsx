'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import {
  getWallet,
  getWalletTransactions,
  getWalletWithdrawConfig,
  requestWithdrawal,
  type WalletInfo,
  type WalletTransaction,
  type WalletWithdrawConfig,
  type WithdrawalMethod,
} from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

const TX_LABELS: Record<string, string> = {
  DEPOSIT: 'Пополнение',
  ENTRY_FEE_HOLD: 'Взнос за турнир',
  ENTRY_FEE_REFUND: 'Возврат взноса',
  PRIZE_PAYOUT: 'Призовые',
  PLATFORM_COMMISSION: 'Комиссия',
  WITHDRAWAL: 'Вывод',
};

const METHOD_LABELS: Record<string, string> = {
  CARD: 'Банковская карта',
  BANK: 'Банковский перевод',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  COMPLETED: 'Завершено',
  FAILED: 'Отклонено',
};

function statusVariant(status: string): 'success' | 'secondary' | 'destructive' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [config, setConfig] = useState<WalletWithdrawConfig | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<WithdrawalMethod>('CARD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadWallet = useCallback(async (token: string) => {
    const [w, tx, cfg] = await Promise.all([
      getWallet(token),
      getWalletTransactions(token),
      getWalletWithdrawConfig(),
    ]);
    setWallet(w);
    setTransactions(tx);
    setConfig(cfg);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/wallet');
      return;
    }
    if (!session?.accessToken) return;
    loadWallet(session.accessToken).catch(() => setError('Не удалось загрузить кошелёк'));
  }, [session?.accessToken, status, router, loadWallet]);

  const hasPendingWithdrawal = transactions.some(
    (tx) => tx.type === 'WITHDRAWAL' && tx.status === 'PENDING',
  );

  async function handleWithdraw(e: FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;

    const parsed = parseInt(amount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Укажите корректную сумму');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await requestWithdrawal(session.accessToken, { amount: parsed, method });
      setWallet((prev) => (prev ? { ...prev, balance: result.wallet.balance } : prev));
      await loadWallet(session.accessToken);
      setAmount('');

      if (result.transaction.status === 'COMPLETED') {
        setSuccess(`Вывод ${formatCurrency(result.transaction.amount)} успешно отправлен`);
      } else if (result.transaction.status === 'FAILED') {
        setError(
          result.transaction.failureReason ?? 'Вывод отклонён, средства возвращены на баланс',
        );
      } else {
        setSuccess('Заявка на вывод принята и обрабатывается');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заявку на вывод');
    } finally {
      setSubmitting(false);
    }
  }

  const minAmount = config?.minAmount ?? 100;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Кошелёк</h1>
      <p className="text-muted-foreground mt-2">Баланс и история транзакций</p>

      <Card className="glass mt-8">
        <CardHeader>
          <CardTitle>Баланс</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-accent text-4xl font-bold">
            {wallet ? formatCurrency(wallet.balance) : '—'}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Призовые зачисляются сюда после завершения турнира
          </p>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Вывести средства</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label htmlFor="withdraw-amount" className="text-sm font-medium">
                Сумма (₽)
              </label>
              <Input
                id="withdraw-amount"
                type="number"
                min={minAmount}
                step={1}
                placeholder={`Минимум ${minAmount} ₽`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting || hasPendingWithdrawal}
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="withdraw-method" className="text-sm font-medium">
                Способ вывода
              </label>
              <select
                id="withdraw-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as WithdrawalMethod)}
                disabled={submitting || hasPendingWithdrawal}
                className="border-input bg-background mt-1 flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="CARD">Банковская карта</option>
                <option value="BANK">Банковский перевод</option>
              </select>
            </div>

            {config?.mockMode && (
              <p className="text-muted-foreground text-xs">
                Mock-режим: сумма, оканчивающаяся на 13 (например 513 ₽), симулирует отказ
                провайдера с возвратом на баланс.
              </p>
            )}

            {hasPendingWithdrawal && (
              <p className="text-sm text-amber-600">Дождитесь обработки текущей заявки на вывод</p>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button
              type="submit"
              disabled={submitting || hasPendingWithdrawal || !wallet || wallet.balance < minAmount}
            >
              {submitting ? 'Отправка…' : 'Вывести'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>История</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">Транзакций пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Турнир / способ</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{TX_LABELS[tx.type] ?? tx.type}</TableCell>
                    <TableCell>
                      {tx.tournament ? (
                        <Link
                          href={`/tournaments/${tx.tournament.slug}`}
                          className="text-accent hover:underline"
                        >
                          {tx.tournament.title}
                        </Link>
                      ) : tx.withdrawalMethod ? (
                        (METHOD_LABELS[tx.withdrawalMethod] ?? tx.withdrawalMethod)
                      ) : (
                        '—'
                      )}
                      {tx.failureReason && (
                        <p className="text-destructive mt-0.5 text-xs">{tx.failureReason}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {tx.type === 'WITHDRAWAL' ? '−' : ''}
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tx.status)}>
                        {STATUS_LABELS[tx.status] ?? tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('ru-RU')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
