export function canCreateTournaments(session: {
  user?: { role?: string; canCreateTournaments?: boolean };
} | null): boolean {
  const user = session?.user;
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') return true;
  return Boolean(user.canCreateTournaments);
}
