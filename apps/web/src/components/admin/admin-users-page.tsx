'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pitchzone/ui';

import { AdminShell } from '@/components/admin/admin-shell';
import { getAdminUsers, updateAdminUser, type AdminUser } from '@/lib/api';
import { formatCurrency } from '@/lib/mock-data';

const ROLES = ['PLAYER', 'ORGANIZER', 'MODERATOR', 'ADMIN'] as const;

const ROLE_LABELS: Record<string, string> = {
  PLAYER: 'Игрок',
  ORGANIZER: 'Организатор',
  MODERATOR: 'Модератор',
  ADMIN: 'Админ',
};

export function AdminUsersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await getAdminUsers(session.accessToken, {
        search: search || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data.items);
      setTotal(data.total);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function patchUser(
    userId: string,
    patch: { role?: string; isVerified?: boolean; canCreateTournaments?: boolean },
  ) {
    if (!session?.accessToken) return;
    setSavingId(userId);
    setMessage('');
    try {
      const updated = await updateAdminUser(session.accessToken, userId, patch);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setMessage('Сохранено');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder="Поиск по email или нику"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Все роли</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-accent mb-4 text-sm">{message}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Верификация</TableHead>
                <TableHead>Турниры</TableHead>
                <TableHead>Баланс</TableHead>
                <TableHead>Рейтинг</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Загрузка…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Не найдено
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link href={`/players/${user.id}`} className="hover:text-accent font-medium">
                        {user.nickname}
                      </Link>
                      <p className="text-muted-foreground text-xs">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <select
                        className="border-input bg-background h-8 rounded border px-2 text-xs"
                        value={user.role}
                        disabled={savingId === user.id}
                        onChange={(e) => patchUser(user.id, { role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={user.isVerified ? 'secondary' : 'outline'}
                        disabled={savingId === user.id}
                        onClick={() => patchUser(user.id, { isVerified: !user.isVerified })}
                      >
                        {user.isVerified ? 'Верифицирован' : 'Не верифицирован'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={user.canCreateTournaments ? 'secondary' : 'outline'}
                        disabled={
                          savingId === user.id || user.role === 'ADMIN' || user.role === 'MODERATOR'
                        }
                        onClick={() =>
                          patchUser(user.id, {
                            canCreateTournaments: !user.canCreateTournaments,
                          })
                        }
                      >
                        {user.role === 'ADMIN' || user.role === 'MODERATOR'
                          ? 'По роли'
                          : user.canCreateTournaments
                            ? 'Разрешено'
                            : 'Запрещено'}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(user.walletBalance)}
                    </TableCell>
                    <TableCell className="text-accent font-mono">{user.rating}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-3 text-xs">Всего: {total}</p>
    </AdminShell>
  );
}
