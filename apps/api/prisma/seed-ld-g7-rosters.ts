/**
 * Demo rosters for Last Dance G7: ULTRAS vs Level Pro (EA gamerTags from ACF).
 */
import { AuthProvider, PlayerPosition, PrismaClient, TeamRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type RosterPlayer = {
  email: string;
  nickname: string;
  gamerTag: string;
  position: PlayerPosition;
};

export const LD_G7_MATCH_ID = 'ld-g7-ultr-lvpr';
/** 22:15 MSK = 19:15 UTC */
export const LD_G7_PLAYED_AT = '2026-08-12T19:15:00.000Z';

const ULTRAS_ROSTER: RosterPlayer[] = [
  { email: 'ld-prospb@demo.pitchzone.gg', nickname: 'PROSPB', gamerTag: 'PROSPB', position: PlayerPosition.GK },
  { email: 'ld-selyaking@demo.pitchzone.gg', nickname: 'Selyaking', gamerTag: 'Selyaking', position: PlayerPosition.CB },
  { email: 'ld-u654yg@demo.pitchzone.gg', nickname: 'u654yg', gamerTag: 'u654yg', position: PlayerPosition.CB },
  { email: 'ld-marrgal@demo.pitchzone.gg', nickname: 'MarrGal', gamerTag: 'MarrGal', position: PlayerPosition.RB },
  { email: 'ld-bata@demo.pitchzone.gg', nickname: 'Bata-helsinki', gamerTag: 'Bata-helsinki', position: PlayerPosition.CM },
  { email: 'ld-iiifan@demo.pitchzone.gg', nickname: 'IIIFANIII', gamerTag: 'IIIFANIII', position: PlayerPosition.CM },
  { email: 'ld-suetolog@demo.pitchzone.gg', nickname: 'suetolog_top1', gamerTag: 'suetolog_top1', position: PlayerPosition.CM },
  { email: 'ld-savid@demo.pitchzone.gg', nickname: 'Savid_kun', gamerTag: 'Savid_kun', position: PlayerPosition.CAM },
  { email: 'ld-ezwin@demo.pitchzone.gg', nickname: 'EzWin_Toxic', gamerTag: 'EzWin_Toxic', position: PlayerPosition.LM },
  { email: 'ld-ozerki@demo.pitchzone.gg', nickname: 'ozerki_308', gamerTag: 'ozerki_308', position: PlayerPosition.LM },
  { email: 'ld-myasnik@demo.pitchzone.gg', nickname: 'Myasnik_89', gamerTag: 'Myasnik_89', position: PlayerPosition.LM },
  { email: 'ld-sassy@demo.pitchzone.gg', nickname: 'sassy_lip4', gamerTag: 'sassy_lip4', position: PlayerPosition.RW },
  { email: 'ld-razgon@demo.pitchzone.gg', nickname: 'Razgon777', gamerTag: 'Razgon777', position: PlayerPosition.LW },
  { email: 'ld-murom@demo.pitchzone.gg', nickname: 'MuRoMeTz7', gamerTag: 'MuRoMeTz7', position: PlayerPosition.ST },
  { email: 'ld-dmitry@demo.pitchzone.gg', nickname: 'DmitryM9', gamerTag: 'DmitryM9', position: PlayerPosition.ST },
];

const LEVEL_PRO_ROSTER: RosterPlayer[] = [
  { email: 'ld-tox1c@demo.pitchzone.gg', nickname: 'Tox1cPadla4737', gamerTag: 'Tox1cPadla4737', position: PlayerPosition.GK },
  { email: 'ld-camokat@demo.pitchzone.gg', nickname: 'xx_CAMOKAT_xx', gamerTag: 'xx_CAMOKAT_xx', position: PlayerPosition.GK },
  { email: 'ld-ark@demo.pitchzone.gg', nickname: 'ARK0929', gamerTag: 'ARK0929', position: PlayerPosition.CB },
  { email: 'ld-hessler@demo.pitchzone.gg', nickname: 'Hessler21', gamerTag: 'Hessler21', position: PlayerPosition.CB },
  { email: 'ld-kemon@demo.pitchzone.gg', nickname: 'kemonitoo', gamerTag: 'kemonitoo', position: PlayerPosition.CB },
  { email: 'ld-mihal@demo.pitchzone.gg', nickname: 'mihal671', gamerTag: 'mihal671', position: PlayerPosition.CB },
  { email: 'ld-nblx@demo.pitchzone.gg', nickname: 'nblx12', gamerTag: 'nblx12', position: PlayerPosition.LB },
  { email: 'ld-alalmay@demo.pitchzone.gg', nickname: 'ALALMAY', gamerTag: 'ALALMAY', position: PlayerPosition.RB },
  { email: 'ld-darth@demo.pitchzone.gg', nickname: 'Darth_Nass', gamerTag: 'Darth_Nass', position: PlayerPosition.RB },
  { email: 'ld-kolob@demo.pitchzone.gg', nickname: 'Kolobaxa', gamerTag: 'Kolobaxa', position: PlayerPosition.CM },
  { email: 'ld-mereng@demo.pitchzone.gg', nickname: 'mereng', gamerTag: 'mereng', position: PlayerPosition.CM },
  { email: 'ld-gio8@demo.pitchzone.gg', nickname: 'GIO8ACM', gamerTag: 'GIO8ACM', position: PlayerPosition.CM },
  { email: 'ld-daggo@demo.pitchzone.gg', nickname: 'DAGGOREC', gamerTag: 'DAGGOREC', position: PlayerPosition.CDM },
  { email: 'ld-wuff@demo.pitchzone.gg', nickname: 'wuff1988', gamerTag: 'wuff1988', position: PlayerPosition.CDM },
  { email: 'ld-boris@demo.pitchzone.gg', nickname: 'Boris_Ronaldo', gamerTag: 'Boris_Ronaldo', position: PlayerPosition.CDM },
  { email: 'ld-gl0rf@demo.pitchzone.gg', nickname: 'gl0rf1n', gamerTag: 'gl0rf1n', position: PlayerPosition.ST },
  { email: 'ld-belarus@demo.pitchzone.gg', nickname: 'Belarussianhope', gamerTag: 'Belarussianhope', position: PlayerPosition.ST },
  { email: 'ld-dekster@demo.pitchzone.gg', nickname: 'DeKcTeP', gamerTag: 'DeKcTeP', position: PlayerPosition.ST },
  { email: 'ld-boss@demo.pitchzone.gg', nickname: 'Za-e-boss_Arm', gamerTag: 'Za-e-boss_Arm', position: PlayerPosition.ST },
];

async function upsertPlayer(prisma: PrismaClient, player: RosterPlayer, passwordHash: string) {
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

async function attachToTeam(prisma: PrismaClient, teamTag: string, players: { id: string }[]) {
  const team = await prisma.team.findUnique({ where: { tag: teamTag } });
  if (!team) return;

  for (const [i, user] of players.entries()) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      create: {
        teamId: team.id,
        userId: user.id,
        role: i === 0 ? TeamRole.OWNER : TeamRole.MEMBER,
      },
      update: {},
    });
  }

  await prisma.team.update({
    where: { id: team.id },
    data: { ownerId: players[0].id },
  });
}

export async function ensureLdG7Rosters(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash('demo12345', 12);

  const ultrasPlayers = await Promise.all(ULTRAS_ROSTER.map((p) => upsertPlayer(prisma, p, passwordHash)));
  const lvprPlayers = await Promise.all(LEVEL_PRO_ROSTER.map((p) => upsertPlayer(prisma, p, passwordHash)));

  await attachToTeam(prisma, 'ULTR', ultrasPlayers);
  await attachToTeam(prisma, 'LVPR', lvprPlayers);
}
