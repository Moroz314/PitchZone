'use client';

import { useSession } from 'next-auth/react';
import { FormEvent, useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@pitchzone/ui';

import { AdminShell } from '@/components/admin/admin-shell';
import { getAdminSettings, updateAdminSettings, type PlatformSettings } from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

export function AdminSettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [commission, setCommission] = useState('10');
  const [privateFee, setPrivateFee] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.accessToken) return;
    getAdminSettings(session.accessToken)
      .then((s) => {
        setSettings(s);
        setCommission(String(s.defaultPlatformCommissionPercent));
        setPrivateFee(String(s.privateTournamentCreationFee));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, [session?.accessToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const updated = await updateAdminSettings(session.accessToken, {
        defaultPlatformCommissionPercent: parseFloat(commission),
        privateTournamentCreationFee: parseInt(privateFee, 10),
      });
      setSettings(updated);
      setMessage(
        'Настройки сохранены. Новые турниры будут использовать обновлённую комиссию по умолчанию.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Комиссии и монетизация</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="commission">Комиссия с призового фонда (%)</Label>
              <Input
                id="commission"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="mt-1"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Применяется к публичным и приватным турнирам. Удерживается при распределении
                призовых.
              </p>
            </div>

            <div>
              <Label htmlFor="private-fee">Плата за создание приватного турнира (₽)</Label>
              <Input
                id="private-fee"
                type="number"
                min={0}
                step={100}
                value={privateFee}
                onChange={(e) => setPrivateFee(e.target.value)}
                className="mt-1"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                0 = бесплатно. Сейчас: {formatCurrency(parseInt(privateFee, 10) || 0)}
              </p>
            </div>

            {settings && (
              <p className="text-muted-foreground text-xs">
                Последнее обновление: {new Date(settings.updatedAt).toLocaleString('ru-RU')}
              </p>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}

            <Button type="submit" disabled={loading}>
              {loading ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
