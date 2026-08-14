/**
 * Demo rosters for No Hope / Amity with gamerTags matching EA Pro Clubs API.
 * Used by seed.ts and seed-last-dance.ts for EA Sync end-to-end tests.
 */
import { AuthProvider, PlayerPosition, PrismaClient, SeasonMatchStatus, TeamRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type RosterPlayer = {
  email: string;
  nickname: string;
  gamerTag: string;
  position: PlayerPosition;
};

const NO_HOPE_ROSTER: RosterPlayer[] = [
  { email: 'nh-kras@demo.pitchzone.gg', nickname: 'NH_Kras', gamerTag: 'NH_Kras', position: PlayerPosition.ST },
  { email: 'zlosem@demo.pitchzone.gg', nickname: 'Zlosem', gamerTag: 'Zlosem', position: PlayerPosition.CB },
  { email: 'vetal@demo.pitchzone.gg', nickname: '7777VeTaL7777', gamerTag: '7777VeTaL7777', position: PlayerPosition.CM },
  { email: 'hax@demo.pitchzone.gg', nickname: 'HA_HAX_TBAPb', gamerTag: 'HA_HAX_TBAPb', position: PlayerPosition.ST },
  { email: 'ziby@demo.pitchzone.gg', nickname: 'Ziby83', gamerTag: 'Ziby83', position: PlayerPosition.CB },
  { email: 'sempliq@demo.pitchzone.gg', nickname: 'S3mpliQ', gamerTag: '_S3mpliQ_', position: PlayerPosition.CDM },
  { email: 'nur@demo.pitchzone.gg', nickname: 'Nur_sultan_08', gamerTag: 'Nur_sultan_08', position: PlayerPosition.CM },
  { email: 'neewho@demo.pitchzone.gg', nickname: 'NeeWhoYamba', gamerTag: 'NeeWhoYamba', position: PlayerPosition.LW },
  { email: 'figase@demo.pitchzone.gg', nickname: 'figase84', gamerTag: 'figase84', position: PlayerPosition.RW },
  { email: 'rauf@demo.pitchzone.gg', nickname: 'Rauf_tkm', gamerTag: 'Rauf_tkm', position: PlayerPosition.CB },
  { email: 'sacred@demo.pitchzone.gg', nickname: 'sacred1288', gamerTag: 'sacred1288', position: PlayerPosition.GK },
];

const AMITY_ROSTER: RosterPlayer[] = [
  { email: 'amity-yankel@demo.pitchzone.gg', nickname: 'Amity_Yankel', gamerTag: 'Amity_Yankel', position: PlayerPosition.ST },
  { email: 'shun23@demo.pitchzone.gg', nickname: 'Shun23', gamerTag: 'Shun23', position: PlayerPosition.CM },
  { email: 'keyni@demo.pitchzone.gg', nickname: 'KeyNi_23', gamerTag: 'KeyNi_23', position: PlayerPosition.CAM },
  { email: 'teyk@demo.pitchzone.gg', nickname: 'TEYK-III', gamerTag: 'TEYK-III', position: PlayerPosition.LW },
  { email: 'nyambi@demo.pitchzone.gg', nickname: 'NyambI4', gamerTag: 'NyambI4', position: PlayerPosition.RW },
  { email: 'friendlinho@demo.pitchzone.gg', nickname: 'Friendlinho', gamerTag: 'Friendlinho', position: PlayerPosition.CB },
  { email: 'wonga@demo.pitchzone.gg', nickname: 'b1ll1-wonga', gamerTag: 'b1ll1-wonga', position: PlayerPosition.CDM },
  { email: 'mola@demo.pitchzone.gg', nickname: 'molaNinho', gamerTag: 'molaNinho', position: PlayerPosition.ST },
  { email: 'arva@demo.pitchzone.gg', nickname: 'ArVa__66', gamerTag: 'ArVa__66', position: PlayerPosition.CB },
  { email: 'hron@demo.pitchzone.gg', nickname: 'Hron89', gamerTag: '-Hron89-', position: PlayerPosition.CM },
  { email: 'icicle@demo.pitchzone.gg', nickname: 'unpaved_icicle3', gamerTag: 'unpaved_icicle3', position: PlayerPosition.GK },
];

export const EA_DEMO_MATCH_PLAYED_AT = '2026-08-11T20:12:41.000Z';
export const EA_LAST_DANCE_MATCH_ID = 'ld-ea-nhop-amty';

async function upsertRosterPlayer(prisma: PrismaClient, player: RosterPlayer, passwordHash: string) {
  return prisma.user.upsert({
    where: { email: player.email },
    update: {
      profile: {
        update: {
          nickname: player.nickname,
          gamerTag: player.gamerTag,
          gamerTagConfirmed: true,
          primaryPosition: player.position,
        },
      },
    },
    create: {
      email: player.email,
      passwordHash,
      profile: {
        create: {
          nickname: player.nickname,
          gamerTag: player.gamerTag,
          gamerTagConfirmed: true,
          primaryPosition: player.position,
          country: 'Россия',
          countryCode: 'RU',
        },
      },
      stats: { create: { rating: 1700, wins: 0, losses: 0, tournamentsPlayed: 0, totalEarnings: 0 } },
      accounts: { create: { provider: AuthProvider.EMAIL, providerAccountId: player.email } },
    },
  });
}

async function ensureTeamMembers(
  prisma: PrismaClient,
  teamId: string,
  players: { id: string }[],
) {
  for (const [i, user] of players.entries()) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: user.id } },
      create: {
        teamId,
        userId: user.id,
        role: i === 0 ? TeamRole.OWNER : TeamRole.MEMBER,
      },
      update: { role: i === 0 ? TeamRole.OWNER : TeamRole.MEMBER },
    });
  }

  await prisma.team.update({
    where: { id: teamId },
    data: { ownerId: players[0].id },
  });
}

/** Ensures NHOP/AMTY demo users exist and are linked as team members (by team tag). */
export async function ensureEaDemoRoster(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash('demo12345', 12);

  const noHopePlayers = await Promise.all(
    NO_HOPE_ROSTER.map((p) => upsertRosterPlayer(prisma, p, passwordHash)),
  );
  const amityPlayers = await Promise.all(
    AMITY_ROSTER.map((p) => upsertRosterPlayer(prisma, p, passwordHash)),
  );

  const noHopeTeam = await prisma.team.findUnique({ where: { tag: 'NHOP' } });
  const amityTeam = await prisma.team.findUnique({ where: { tag: 'AMTY' } });

  if (noHopeTeam) await ensureTeamMembers(prisma, noHopeTeam.id, noHopePlayers);
  if (amityTeam) await ensureTeamMembers(prisma, amityTeam.id, amityPlayers);

  return { noHopeTeam, amityTeam, noHopePlayers, amityPlayers };
}

/** Reset EA import state so poll can run again for a season match. */
export async function resetEaMatchForPoll(prisma: PrismaClient, seasonMatchId: string) {
  await prisma.playerMatchStat.deleteMany({ where: { seasonMatchId } });
  await prisma.seasonMatch.update({
    where: { id: seasonMatchId },
    data: {
      eaMatchId: null,
      homeScore: null,
      awayScore: null,
      status: SeasonMatchStatus.SCHEDULED,
    },
  });
  await prisma.eaApiMatchImport.deleteMany({
    where: {
      OR: [{ eaClubLink: { team: { tag: 'NHOP' } } }, { eaClubLink: { team: { tag: 'AMTY' } } }],
    },
  });
}
