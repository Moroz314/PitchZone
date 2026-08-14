'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@pitchzone/ui';

import {
  acceptContract,
  buyoutContract,
  declineContract,
  getMyContracts,
  type ContractItem,
} from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает ответа',
  ACTIVE: 'Активен',
  DECLINED: 'Отклонён',
  EXPIRED: 'Истёк',
  TERMINATED: 'Расторгнут',
};

export default function ContractsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/contracts');
      return;
    }
    if (!session?.accessToken) return;

    getMyContracts(session.accessToken)
      .then(setContracts)
      .catch(() => setContracts([]));
  }, [session?.accessToken, status, router]);

  async function reload() {
    if (!session?.accessToken) return;
    setContracts(await getMyContracts(session.accessToken));
  }

  async function handleAccept(id: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      await acceptContract(session.accessToken, id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline(id: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      await declineContract(session.accessToken, id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuyout(id: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      await buyoutContract(session.accessToken, id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading') return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-accent">
          ← На главную
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Мои контракты</h1>
        <p className="mt-2 text-muted-foreground">
          Предложения от клубов и условия вашего текущего контракта
        </p>
      </div>

      <div className="space-y-4">
        {contracts.length === 0 && (
          <Card>
            <CardContent className="p-6 text-muted-foreground">Контрактов пока нет</CardContent>
          </Card>
        )}

        {contracts.map((contract) => (
          <Card key={contract.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">
                <Link href={`/teams/${contract.club.id}`} className="hover:text-accent">
                  [{contract.club.tag}] {contract.club.name}
                </Link>
              </CardTitle>
              <Badge>{STATUS_LABELS[contract.status] ?? contract.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Срок: {contract.durationMonths} мес.
                {contract.endDate && (
                  <> · до {new Date(contract.endDate).toLocaleDateString('ru-RU')}</>
                )}
              </p>
              {contract.buyoutFee > 0 && <p>Отступные: {contract.buyoutFee} ₽</p>}
              {contract.offeredByNickname && (
                <p className="text-muted-foreground">Предложил: {contract.offeredByNickname}</p>
              )}

              {contract.status === 'PENDING' && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={loading} onClick={() => handleAccept(contract.id)}>
                    Принять
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => handleDecline(contract.id)}
                  >
                    Отклонить
                  </Button>
                </div>
              )}

              {contract.status === 'ACTIVE' && contract.buyoutFee > 0 && (
                <Button size="sm" variant="outline" disabled={loading} onClick={() => handleBuyout(contract.id)}>
                  Уйти, выплатив отступные
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
