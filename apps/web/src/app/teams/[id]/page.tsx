import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
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

import { getTeam } from '@/lib/api';
import { ClubManagement } from '@/components/clubs/club-management';
import { KitPreview } from '@/components/clubs/kit-preview';
import { TeamManagement } from '@/components/teams/team-management';

export const dynamic = 'force-dynamic';

interface TeamPageProps {
  params: Promise<{ id: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  CAPTAIN: 'Капитан',
  MEMBER: 'Игрок',
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { id } = await params;

  let team;
  try {
    team = await getTeam(id);
  } catch {
    notFound();
  }

  const totalGames = team.totalWins + (team.totalDraws ?? 0) + team.totalLosses;
  const winRate = totalGames > 0 ? Math.round((team.totalWins / totalGames) * 1000) / 10 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {team.coverBannerUrl && (
        <div
          className="mb-8 h-32 overflow-hidden rounded-2xl bg-cover bg-center sm:h-40"
          style={{ backgroundImage: `url(${team.coverBannerUrl})` }}
        />
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="from-accent/30 to-accent-cyan/20 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br">
          {team.avatar ? (
            <Avatar className="h-24 w-24 rounded-2xl">
              <AvatarImage src={team.avatar} />
              <AvatarFallback className="rounded-2xl text-2xl">{team.tag}</AvatarFallback>
            </Avatar>
          ) : team.kitTemplateId ? (
            <KitPreview
              templateId={team.kitTemplateId}
              primaryColor={team.primaryColor ?? '#1a1a2e'}
              secondaryColor={team.secondaryColor ?? '#C6FF3D'}
              accentColor={team.accentColor}
              className="h-24 w-24 rounded-2xl"
            />
          ) : (
            <span className="font-display text-accent text-3xl font-bold">[{team.tag}]</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{team.name}</h1>
            <Badge variant="outline">{team.countryCode}</Badge>
            {team.kitTemplateName && (
              <Badge variant="secondary">Форма: {team.kitTemplateName}</Badge>
            )}
          </div>
          {team.description && <p className="text-muted-foreground mt-2">{team.description}</p>}
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-sm">
            {team.vkGroupUrl && (
              <a
                href={team.vkGroupUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                VK
              </a>
            )}
            {team.twitchUrl && (
              <a
                href={team.twitchUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                Twitch
              </a>
            )}
            {team.youtubeUrl && (
              <a
                href={team.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                YouTube
              </a>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Основана {team.createdAt} · Капитан:{' '}
            <Link href={`/players/${team.owner.id}`} className="text-accent hover:underline">
              {team.owner.nickname}
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Средний рейтинг', value: team.avgRating },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Побед', value: team.totalWins },
          { label: 'Игроков', value: team.memberCount },
        ].map((stat) => (
          <Card key={stat.label} className="glass">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="font-display text-accent text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Состав команды</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Игрок</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Рейтинг</TableHead>
                <TableHead>W/L</TableHead>
                <TableHead>В команде с</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link
                      href={`/players/${member.id}`}
                      className="hover:text-accent flex items-center gap-2 font-medium"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {member.nickname?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {member.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-accent font-mono">{member.rating}</TableCell>
                  <TableCell>
                    {member.wins}/{member.losses}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.joinedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {team.tournamentStats && team.tournamentStats.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Статистика в турнирах</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Турнир</TableHead>
                  <TableHead>W/D/L</TableHead>
                  <TableHead>Голы</TableHead>
                  <TableHead>Обновлено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.tournamentStats.map((s) => (
                  <TableRow key={s.tournamentId}>
                    <TableCell>
                      <Link
                        href={`/tournaments/${s.tournamentSlug}`}
                        className="text-accent hover:underline"
                      >
                        {s.tournamentTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.wins}/{s.draws}/{s.losses}
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.goalsFor}:{s.goalsAgainst}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.updatedAt.split('T')[0]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <TeamManagement team={team} />
      <ClubManagement team={team} />
    </div>
  );
}
