import { UserRole } from '@prisma/client';

export function userCanCreateTournaments(user: {
  role: UserRole;
  canCreateTournaments: boolean;
}): boolean {
  return (
    user.role === UserRole.ADMIN ||
    user.role === UserRole.MODERATOR ||
    user.canCreateTournaments
  );
}
