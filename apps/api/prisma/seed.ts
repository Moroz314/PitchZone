import {
  AuthProvider,
  DisputeStatus,
  EscrowStatus,
  GameTitle,
  MatchFormat,
  MatchStatus,
  PaymentStatus,
  PrizePoolType,
  ProofRequirement,
  PrismaClient,
  TeamRole,
  TournamentFormat,
  TournamentInviteStatus,
  TournamentStatus,
  TournamentVisibility,
  TransactionStatus,
  TransactionType,
  UserRole,
  SeasonStatus,
  SeasonType,
  DivisionTier,
  PlayerPosition,
  SeasonMatchStatus,
  AwardCategory,
  EaClubPlatform,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('demo12345', 12);

  const neonStriker = await prisma.user.upsert({
    where: { email: 'neon@pitchzone.gg' },
    update: { role: UserRole.ORGANIZER, isVerified: true, canCreateTournaments: true },
    create: {
      email: 'neon@pitchzone.gg',
      passwordHash,
      emailVerified: new Date(),
      role: UserRole.ORGANIZER,
      isVerified: true,
      canCreateTournaments: true,
      profile: {
        create: {
          nickname: 'NeonStriker',
          country: 'Россия',
          countryCode: 'RU',
          bio: 'Профессиональный киберфутболист EA FC',
          gamerTag: 'NeonStriker',
          gamerTagConfirmed: true,
          primaryPosition: PlayerPosition.ST,
          city: 'Москва',
          profileCompletedAt: new Date(),
        },
      },
      stats: {
        create: {
          rating: 1847,
          wins: 156,
          losses: 89,
          tournamentsPlayed: 34,
          totalEarnings: 87500,
        },
      },
      accounts: {
        create: {
          provider: AuthProvider.EMAIL,
          providerAccountId: 'neon@pitchzone.gg',
        },
      },
    },
  });

  const cyberKeeper = await prisma.user.upsert({
    where: { email: 'cyber@pitchzone.gg' },
    update: {},
    create: {
      email: 'cyber@pitchzone.gg',
      passwordHash,
      profile: {
        create: {
          nickname: 'CyberKeeper',
          country: 'Россия',
          countryCode: 'RU',
        },
      },
      stats: {
        create: {
          rating: 1798,
          wins: 120,
          losses: 95,
          tournamentsPlayed: 28,
          totalEarnings: 52000,
        },
      },
      accounts: {
        create: {
          provider: AuthProvider.EMAIL,
          providerAccountId: 'cyber@pitchzone.gg',
        },
      },
    },
  });

  const pitchMaster = await prisma.user.upsert({
    where: { email: 'pitch@pitchzone.gg' },
    update: {},
    create: {
      email: 'pitch@pitchzone.gg',
      passwordHash,
      profile: {
        create: {
          nickname: 'PitchMaster',
          country: 'Казахстан',
          countryCode: 'KZ',
        },
      },
      stats: {
        create: {
          rating: 1823,
          wins: 140,
          losses: 80,
          tournamentsPlayed: 30,
          totalEarnings: 68000,
        },
      },
      accounts: {
        create: {
          provider: AuthProvider.EMAIL,
          providerAccountId: 'pitch@pitchzone.gg',
        },
      },
    },
  });

  const neonTeam = await prisma.team.upsert({
    where: { tag: 'NEON' },
    update: {},
    create: {
      name: 'Neon Esports',
      tag: 'NEON',
      country: 'Россия',
      countryCode: 'RU',
      description: 'Профессиональная команда по EA FC',
      ownerId: neonStriker.id,
      members: {
        create: [
          { userId: neonStriker.id, role: TeamRole.OWNER },
          { userId: cyberKeeper.id, role: TeamRole.MEMBER },
          { userId: pitchMaster.id, role: TeamRole.CAPTAIN },
        ],
      },
    },
  });

  const winterCup = await prisma.tournament.upsert({
    where: { slug: 'ea-fc-winter-cup' },
    update: { status: TournamentStatus.REGISTRATION_OPEN },
    create: {
      slug: 'ea-fc-winter-cup',
      title: 'EA FC Winter Cup 2026',
      description: 'Зимний кубок EA FC с призовым фондом от взносов участников.',
      game: GameTitle.EA_FC,
      format: TournamentFormat.SINGLE_ELIMINATION,
      matchFormat: MatchFormat.BO3,
      teamSize: 1,
      status: TournamentStatus.REGISTRATION_OPEN,
      prizePool: 36000,
      prizePoolType: PrizePoolType.FROM_FEES,
      entryFee: 500,
      platformCommissionPercent: 10,
      prizeDistribution: [
        { place: 1, percent: 50 },
        { place: 2, percent: 30 },
        { place: 3, percent: 20 },
      ],
      maxParticipants: 8,
      minParticipants: 4,
      registrationDeadline: new Date('2026-08-14T18:00:00Z'),
      rulesText: 'Запрещены читы и эксплойты. Результат подтверждается скриншотом финального счёта.',
      proofRequirement: ProofRequirement.SCREENSHOT,
      visibility: TournamentVisibility.PUBLIC,
      startsAt: new Date('2026-08-15T18:00:00Z'),
      bannerGradient: 'from-accent/30 via-accent-cyan/20 to-transparent',
      organizerId: neonStriker.id,
    },
  });

  const neonLeague = await prisma.tournament.upsert({
    where: { slug: 'neon-league-s3' },
    update: { status: TournamentStatus.LIVE },
    create: {
      slug: 'neon-league-s3',
      title: 'Neon League Season 3',
      description: 'Сезонная лига Neon Esports.',
      game: GameTitle.EA_FC,
      format: TournamentFormat.SINGLE_ELIMINATION,
      matchFormat: MatchFormat.BO3,
      teamSize: 1,
      status: TournamentStatus.LIVE,
      prizePool: 120000,
      prizePoolType: PrizePoolType.FIXED_SPONSORED,
      fixedPrizePool: 120000,
      entryFee: 1000,
      platformCommissionPercent: 10,
      prizeDistribution: [
        { place: 1, percent: 60 },
        { place: 2, percent: 40 },
      ],
      maxParticipants: 8,
      minParticipants: 4,
      registrationDeadline: new Date('2026-08-09T12:00:00Z'),
      rulesText: 'Стандартный регламент Neon League. Все матчи Bo3.',
      proofRequirement: ProofRequirement.SCREENSHOT,
      visibility: TournamentVisibility.PUBLIC,
      startsAt: new Date('2026-08-10T12:00:00Z'),
      bannerGradient: 'from-live/30 via-accent/10 to-transparent',
      organizerId: neonStriker.id,
    },
  });

  const players = [neonStriker, pitchMaster, cyberKeeper];

  for (const player of players) {
    await prisma.wallet.upsert({
      where: { userId: player.id },
      create: { userId: player.id },
      update: {},
    });
  }

  await prisma.escrowAccount.upsert({
    where: { tournamentId: winterCup.id },
    create: {
      tournamentId: winterCup.id,
      totalHeld: 500 * 3,
      status: EscrowStatus.HOLDING,
    },
    update: { totalHeld: 500 * 3 },
  });

  await prisma.escrowAccount.upsert({
    where: { tournamentId: neonLeague.id },
    create: {
      tournamentId: neonLeague.id,
      totalHeld: 1000 * 3,
      status: EscrowStatus.HOLDING,
    },
    update: { totalHeld: 1000 * 3 },
  });

  for (let i = 0; i < players.length; i++) {
    const participant = await prisma.tournamentParticipant.upsert({
      where: {
        tournamentId_userId: { tournamentId: winterCup.id, userId: players[i].id },
      },
      update: { paymentStatus: PaymentStatus.PAID },
      create: {
        tournamentId: winterCup.id,
        userId: players[i].id,
        seed: i + 1,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: players[i].id } });
    if (wallet) {
      await prisma.transaction.deleteMany({
        where: { relatedParticipantId: participant.id, type: TransactionType.ENTRY_FEE_HOLD },
      });
      await prisma.transaction.create({
        data: {
          userId: players[i].id,
          walletId: wallet.id,
          type: TransactionType.ENTRY_FEE_HOLD,
          amount: 500,
          relatedTournamentId: winterCup.id,
          relatedParticipantId: participant.id,
          status: TransactionStatus.COMPLETED,
          externalPaymentId: `mock_seed_${participant.id}`,
        },
      });
    }
  }

  for (let i = 0; i < players.length; i++) {
    await prisma.tournamentParticipant.upsert({
      where: {
        tournamentId_userId: { tournamentId: neonLeague.id, userId: players[i].id },
      },
      update: { paymentStatus: PaymentStatus.PAID },
      create: {
        tournamentId: neonLeague.id,
        userId: players[i].id,
        seed: i + 1,
        paymentStatus: PaymentStatus.PAID,
      },
    });
  }

  const neonParticipants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId: neonLeague.id },
    orderBy: { seed: 'asc' },
  });
  const pNeon = neonParticipants.find((p) => p.userId === neonStriker.id)!;
  const pPitch = neonParticipants.find((p) => p.userId === pitchMaster.id)!;
  const pCyber = neonParticipants.find((p) => p.userId === cyberKeeper.id)!;

  const goalHunter = await prisma.user.upsert({
    where: { email: 'goal@pitchzone.gg' },
    update: {},
    create: {
      email: 'goal@pitchzone.gg',
      passwordHash,
      profile: {
        create: {
          nickname: 'GoalHunter',
          country: 'Россия',
          countryCode: 'RU',
        },
      },
      stats: {
        create: {
          rating: 1650,
          wins: 80,
          losses: 60,
          tournamentsPlayed: 15,
          totalEarnings: 12000,
        },
      },
      accounts: {
        create: {
          provider: AuthProvider.EMAIL,
          providerAccountId: 'goal@pitchzone.gg',
        },
      },
    },
  });

  await prisma.teamInvite.deleteMany({
    where: { teamId: neonTeam.id, inviteeId: goalHunter.id },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.teamInvite.create({
    data: {
      teamId: neonTeam.id,
      inviterId: neonStriker.id,
      inviteeId: goalHunter.id,
      expiresAt,
    },
  });

  await prisma.match.deleteMany({ where: { tournamentId: neonLeague.id } });

  const qf1 = await prisma.match.create({
    data: {
      tournamentId: neonLeague.id,
      round: 1,
      position: 0,
      participant1Id: pNeon.id,
      participant2Id: pCyber.id,
      participant1Name: 'NeonStriker',
      participant2Name: 'CyberKeeper',
      score1: 3,
      score2: 1,
      status: MatchStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  const qf2 = await prisma.match.create({
    data: {
      tournamentId: neonLeague.id,
      round: 1,
      position: 1,
      participant1Id: pPitch.id,
      participant1Name: 'PitchMaster',
      participant2Name: 'TBD',
      score1: 2,
      score2: 0,
      status: MatchStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  const sf1 = await prisma.match.create({
    data: {
      tournamentId: neonLeague.id,
      round: 2,
      position: 0,
      participant1Id: pNeon.id,
      participant2Id: pPitch.id,
      participant1Name: 'NeonStriker',
      participant2Name: 'PitchMaster',
      status: MatchStatus.IN_PROGRESS,
      scheduledAt: new Date(),
      isActive: true,
      nextMatchId: null,
    },
  });

  await prisma.match.update({ where: { id: qf1.id }, data: { nextMatchId: sf1.id } });
  await prisma.match.update({ where: { id: qf2.id }, data: { nextMatchId: sf1.id } });

  const final = await prisma.match.create({
    data: {
      tournamentId: neonLeague.id,
      round: 3,
      position: 0,
      participant1Name: 'TBD',
      participant2Name: 'TBD',
      status: MatchStatus.PENDING,
    },
  });

  await prisma.match.update({ where: { id: sf1.id }, data: { nextMatchId: final.id } });

  const modUser = await prisma.user.upsert({
    where: { email: 'mod@pitchzone.gg' },
    update: { role: UserRole.MODERATOR, isStatTracker: true },
    create: {
      email: 'mod@pitchzone.gg',
      passwordHash,
      role: UserRole.MODERATOR,
      isStatTracker: true,
      profile: {
        create: {
          nickname: 'ModMaster',
          country: 'Россия',
          countryCode: 'RU',
        },
      },
      stats: { create: {} },
      accounts: {
        create: {
          provider: AuthProvider.EMAIL,
          providerAccountId: 'mod@pitchzone.gg',
        },
      },
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@pitchzone.gg' },
    update: { role: UserRole.ADMIN, isVerified: true },
    create: {
      email: 'admin@pitchzone.gg',
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
      profile: {
        create: {
          nickname: 'PitchAdmin',
          country: 'Россия',
          countryCode: 'RU',
        },
      },
      stats: { create: {} },
      accounts: {
        create: {
          provider: AuthProvider.EMAIL,
          providerAccountId: 'admin@pitchzone.gg',
        },
      },
    },
  });

  await prisma.platformSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', defaultPlatformCommissionPercent: 10, privateTournamentCreationFee: 0 },
    update: {},
  });

  const winterParticipants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId: winterCup.id },
  });
  const wpCyber = winterParticipants.find((p) => p.userId === cyberKeeper.id)!;
  const wpPitch = winterParticipants.find((p) => p.userId === pitchMaster.id)!;

  const disputedMatch = await prisma.match.upsert({
    where: {
      tournamentId_round_position: {
        tournamentId: winterCup.id,
        round: 1,
        position: 99,
      },
    },
    update: { status: MatchStatus.DISPUTED },
    create: {
      tournamentId: winterCup.id,
      round: 1,
      position: 99,
      participant1Id: wpCyber.id,
      participant2Id: wpPitch.id,
      participant1Name: 'CyberKeeper',
      participant2Name: 'PitchMaster',
      status: MatchStatus.DISPUTED,
    },
  });

  await prisma.matchSubmission.deleteMany({ where: { matchId: disputedMatch.id } });

  await prisma.matchSubmission.createMany({
    data: [
      {
        matchId: disputedMatch.id,
        participantId: wpCyber.id,
        userId: cyberKeeper.id,
        score1: 2,
        score2: 1,
        proofUrl: 'https://placehold.co/600x400/1a1a2e/C6FF3D/png?text=CyberKeeper+2-1',
      },
      {
        matchId: disputedMatch.id,
        participantId: wpPitch.id,
        userId: pitchMaster.id,
        score1: 1,
        score2: 2,
        proofUrl: 'https://placehold.co/600x400/1a1a2e/3DE7FF/png?text=PitchMaster+1-2',
      },
    ],
  });

  await prisma.dispute.upsert({
    where: { matchId: disputedMatch.id },
    update: { status: DisputeStatus.OPEN },
    create: {
      matchId: disputedMatch.id,
      openedById: cyberKeeper.id,
      reasonText: 'Расхождение в отчётах о счёте',
      status: DisputeStatus.OPEN,
    },
  });

  const rapidCup = await prisma.tournament.upsert({
    where: { slug: 'rapid-cup' },
    update: { status: TournamentStatus.FINISHED },
    create: {
      slug: 'rapid-cup',
      title: 'Rapid Cup — Demo Final',
      description: 'Завершённый турнир для демонстрации выплат и Elo.',
      game: GameTitle.EA_FC,
      format: TournamentFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.FINISHED,
      prizePool: 1800,
      prizePoolType: PrizePoolType.FROM_FEES,
      entryFee: 1000,
      platformCommissionPercent: 10,
      prizeDistribution: [
        { place: 1, percent: 60 },
        { place: 2, percent: 40 },
      ],
      maxParticipants: 2,
      minParticipants: 2,
      registrationDeadline: new Date('2026-08-01T12:00:00Z'),
      rulesText: 'Bo1 финал. Демо-турнир с автоматическими выплатами.',
      startsAt: new Date('2026-08-02T12:00:00Z'),
      endsAt: new Date('2026-08-02T14:00:00Z'),
      bannerGradient: 'from-success/20 to-transparent',
      organizerId: neonStriker.id,
    },
  });

  const rapidP1 = await prisma.tournamentParticipant.upsert({
    where: { tournamentId_userId: { tournamentId: rapidCup.id, userId: neonStriker.id } },
    update: { paymentStatus: PaymentStatus.PAID, placement: 1, prizeAmount: 1620 },
    create: {
      tournamentId: rapidCup.id,
      userId: neonStriker.id,
      seed: 1,
      paymentStatus: PaymentStatus.PAID,
      placement: 1,
      prizeAmount: 1620,
    },
  });

  const rapidP2 = await prisma.tournamentParticipant.upsert({
    where: { tournamentId_userId: { tournamentId: rapidCup.id, userId: pitchMaster.id } },
    update: { paymentStatus: PaymentStatus.PAID, placement: 2, prizeAmount: 1080 },
    create: {
      tournamentId: rapidCup.id,
      userId: pitchMaster.id,
      seed: 2,
      paymentStatus: PaymentStatus.PAID,
      placement: 2,
      prizeAmount: 1080,
    },
  });

  await prisma.match.deleteMany({ where: { tournamentId: rapidCup.id } });
  await prisma.match.create({
    data: {
      tournamentId: rapidCup.id,
      round: 1,
      position: 0,
      participant1Id: rapidP1.id,
      participant2Id: rapidP2.id,
      participant1Name: 'NeonStriker',
      participant2Name: 'PitchMaster',
      score1: 3,
      score2: 1,
      winnerId: rapidP1.id,
      status: MatchStatus.COMPLETED,
      completedAt: new Date('2026-08-02T14:00:00Z'),
    },
  });

  await prisma.escrowAccount.upsert({
    where: { tournamentId: rapidCup.id },
    create: { tournamentId: rapidCup.id, totalHeld: 0, status: EscrowStatus.DISTRIBUTED },
    update: { totalHeld: 0, status: EscrowStatus.DISTRIBUTED },
  });

  const neonWallet = await prisma.wallet.upsert({
    where: { userId: neonStriker.id },
    create: { userId: neonStriker.id, balance: 1620 },
    update: { balance: { increment: 0 } },
  });

  const pitchWallet = await prisma.wallet.upsert({
    where: { userId: pitchMaster.id },
    create: { userId: pitchMaster.id, balance: 1080 },
    update: { balance: { increment: 0 } },
  });

  await prisma.transaction.deleteMany({ where: { relatedTournamentId: rapidCup.id } });
  await prisma.transaction.createMany({
    data: [
      {
        userId: neonStriker.id,
        walletId: neonWallet.id,
        type: TransactionType.PRIZE_PAYOUT,
        amount: 1620,
        relatedTournamentId: rapidCup.id,
        relatedParticipantId: rapidP1.id,
        status: TransactionStatus.COMPLETED,
      },
      {
        userId: pitchMaster.id,
        walletId: pitchWallet.id,
        type: TransactionType.PRIZE_PAYOUT,
        amount: 1080,
        relatedTournamentId: rapidCup.id,
        relatedParticipantId: rapidP2.id,
        status: TransactionStatus.COMPLETED,
      },
      {
        userId: neonStriker.id,
        type: TransactionType.PLATFORM_COMMISSION,
        amount: 200,
        relatedTournamentId: rapidCup.id,
        status: TransactionStatus.COMPLETED,
      },
    ],
  });

  const rushTeam = await prisma.team.upsert({
    where: { tag: 'RUSH' },
    update: {},
    create: {
      name: 'Rush FC',
      tag: 'RUSH',
      country: 'Россия',
      countryCode: 'RU',
      description: 'Команда для приватных матчей',
      ownerId: goalHunter.id,
      members: {
        create: [
          { userId: goalHunter.id, role: TeamRole.OWNER },
          { userId: cyberKeeper.id, role: TeamRole.CAPTAIN },
        ],
      },
    },
  });

  const privateDuel = await prisma.tournament.upsert({
    where: { slug: 'private-duel-demo' },
    update: {
      status: TournamentStatus.REGISTRATION_OPEN,
      inviteToken: 'demo-private-invite-token',
    },
    create: {
      slug: 'private-duel-demo',
      title: 'Приватный матч NEON vs RUSH',
      description: 'Демо приватного командного турнира между двумя командами (не в листинге).',
      game: GameTitle.EA_FC,
      format: TournamentFormat.SINGLE_ELIMINATION,
      matchFormat: MatchFormat.BO1,
      teamSize: 2,
      status: TournamentStatus.REGISTRATION_OPEN,
      prizePool: 1800,
      prizePoolType: PrizePoolType.FROM_FEES,
      entryFee: 1000,
      platformCommissionPercent: 10,
      prizeDistribution: [{ place: 1, percent: 100 }],
      maxParticipants: 2,
      minParticipants: 2,
      registrationDeadline: new Date('2026-08-20T18:00:00Z'),
      rulesText: 'Приватный матч на деньги между приглашёнными командами.',
      proofRequirement: ProofRequirement.SCREENSHOT,
      visibility: TournamentVisibility.PRIVATE,
      inviteToken: 'demo-private-invite-token',
      startsAt: new Date('2026-08-21T18:00:00Z'),
      bannerGradient: 'from-purple-500/20 via-accent/10 to-transparent',
      organizerId: pitchMaster.id,
    },
  });

  await prisma.tournamentInvite.deleteMany({ where: { tournamentId: privateDuel.id } });
  await prisma.tournamentInvite.createMany({
    data: [
      {
        tournamentId: privateDuel.id,
        invitedTeamId: neonTeam.id,
        invitedByUserId: pitchMaster.id,
        status: TournamentInviteStatus.PENDING,
      },
      {
        tournamentId: privateDuel.id,
        invitedTeamId: rushTeam.id,
        invitedByUserId: pitchMaster.id,
        status: TournamentInviteStatus.PENDING,
      },
    ],
  });

  await prisma.escrowAccount.upsert({
    where: { tournamentId: privateDuel.id },
    create: { tournamentId: privateDuel.id, totalHeld: 0 },
    update: {},
  });

  const kitTemplates = [
    { id: 'classic', name: 'Классический', sortOrder: 1 },
    { id: 'vertical-stripes', name: 'Вертикальные полосы', sortOrder: 2 },
    { id: 'chest-stripe', name: 'Полоса на груди', sortOrder: 3 },
    { id: 'diagonal', name: 'Диагональ', sortOrder: 4 },
    { id: 'contrast-sleeves', name: 'Контрастные рукава', sortOrder: 5 },
    { id: 'center-stripe', name: 'Центральная полоса', sortOrder: 6 },
    { id: 'halves', name: 'Половинки', sortOrder: 7 },
    { id: 'geometric', name: 'Геометрический узор', sortOrder: 8 },
  ];

  for (const template of kitTemplates) {
    await prisma.kitTemplate.upsert({
      where: { id: template.id },
      create: template,
      update: { name: template.name, sortOrder: template.sortOrder },
    });
  }

  const demoYear = new Date().getFullYear();
  const firstSeason = await prisma.season.upsert({
    where: { id: 'demo-season-first' },
    create: {
      id: 'demo-season-first',
      name: `Осень-зима ${demoYear} (демо)`,
      type: SeasonType.REGULAR,
      year: demoYear,
      calendarSlot: 'AUTUMN_WINTER',
      startDate: new Date(`${demoYear}-10-01`),
      endDate: new Date(`${demoYear}-12-31`),
      status: SeasonStatus.FINISHED,
      hasDivisions: false,
      entryFee: 0,
      lanPointsWeight: 1.0,
    },
    update: { status: SeasonStatus.FINISHED },
  });

  const noneDivision = await prisma.division.upsert({
    where: {
      seasonId_name_groupLabel: { seasonId: firstSeason.id, name: DivisionTier.NONE, groupLabel: '' },
    },
    create: { seasonId: firstSeason.id, name: DivisionTier.NONE, tierOrder: 0 },
    update: {},
  });

  await prisma.seasonTeamEntry.upsert({
    where: { seasonId_teamId: { seasonId: firstSeason.id, teamId: neonTeam.id } },
    create: {
      seasonId: firstSeason.id,
      divisionId: noneDivision.id,
      teamId: neonTeam.id,
      managerId: neonStriker.id,
      points: 24,
      matchesPlayed: 10,
      wins: 7,
      draws: 3,
      losses: 0,
      goalsFor: 28,
      goalsAgainst: 8,
      finalPosition: 1,
    },
    update: { finalPosition: 1, points: 24 },
  });

  await prisma.seasonTeamEntry.upsert({
    where: { seasonId_teamId: { seasonId: firstSeason.id, teamId: rushTeam.id } },
    create: {
      seasonId: firstSeason.id,
      divisionId: noneDivision.id,
      teamId: rushTeam.id,
      managerId: pitchMaster.id,
      points: 18,
      matchesPlayed: 10,
      wins: 5,
      draws: 3,
      losses: 2,
      goalsFor: 20,
      goalsAgainst: 14,
      finalPosition: 2,
    },
    update: { finalPosition: 2, points: 18 },
  });

  const secondSeason = await prisma.season.upsert({
    where: { id: 'demo-season-second' },
    create: {
      id: 'demo-season-second',
      name: `Зима-весна ${demoYear + 1} (демо)`,
      type: SeasonType.REGULAR,
      year: demoYear + 1,
      calendarSlot: 'WINTER_SPRING',
      startDate: new Date(`${demoYear + 1}-01-15`),
      endDate: new Date(`${demoYear + 1}-03-31`),
      status: SeasonStatus.REGISTRATION,
      hasDivisions: true,
      entryFee: 0,
      lanPointsWeight: 1.1,
    },
    update: { status: SeasonStatus.REGISTRATION },
  });

  for (const [name, tierOrder] of [
    [DivisionTier.GOLD, 1],
    [DivisionTier.SILVER, 2],
    [DivisionTier.BRONZE, 3],
  ] as const) {
    await prisma.division.upsert({
      where: { seasonId_name_groupLabel: { seasonId: secondSeason.id, name, groupLabel: '' } },
      create: { seasonId: secondSeason.id, name, tierOrder },
      update: { tierOrder },
    });
  }

  const goldDiv = await prisma.division.findFirstOrThrow({
    where: { seasonId: secondSeason.id, name: DivisionTier.GOLD },
  });
  const silverDiv = await prisma.division.findFirstOrThrow({
    where: { seasonId: secondSeason.id, name: DivisionTier.SILVER },
  });
  const bronzeDiv = await prisma.division.findFirstOrThrow({
    where: { seasonId: secondSeason.id, name: DivisionTier.BRONZE },
  });

  for (const [divId, promoteTopN, relegateBottomN] of [
    [goldDiv.id, 0, 1],
    [silverDiv.id, 1, 1],
    [bronzeDiv.id, 1, 0],
  ] as const) {
    await prisma.promotionRelegationRule.upsert({
      where: { seasonId_divisionId: { seasonId: secondSeason.id, divisionId: divId } },
      create: { seasonId: secondSeason.id, divisionId: divId, promoteTopN, relegateBottomN },
      update: { promoteTopN, relegateBottomN },
    });
  }

  const demoMatch = await prisma.seasonMatch.upsert({
    where: { id: 'demo-season-match-1' },
    create: {
      id: 'demo-season-match-1',
      seasonId: firstSeason.id,
      divisionId: noneDivision.id,
      roundNumber: 1,
      weekLabel: 'Тур 1',
      homeTeamId: neonTeam.id,
      awayTeamId: rushTeam.id,
      homeScore: 3,
      awayScore: 1,
      status: SeasonMatchStatus.COMPLETED,
      playedAt: new Date(`${demoYear}-11-15`),
    },
    update: { status: SeasonMatchStatus.COMPLETED },
  });

  await prisma.playerMatchStat.upsert({
    where: { seasonMatchId_userId: { seasonMatchId: demoMatch.id, userId: neonStriker.id } },
    create: {
      seasonMatchId: demoMatch.id,
      userId: neonStriker.id,
      positionPlayed: PlayerPosition.ST,
      passAccuracy: 82,
      dribbles: 4,
      tacklesWon: 2,
      goals: 2,
      assists: 1,
      xpEarned: 68,
      enteredById: modUser.id,
    },
    update: { xpEarned: 68 },
  });

  await prisma.seasonXpSummary.upsert({
    where: { seasonId_userId: { seasonId: firstSeason.id, userId: neonStriker.id } },
    create: {
      seasonId: firstSeason.id,
      userId: neonStriker.id,
      totalXp: 68,
      matchesPlayed: 1,
      eligibleForRecalculation: false,
    },
    update: { totalXp: 68, matchesPlayed: 1 },
  });

  await prisma.playerStats.update({
    where: { userId: neonStriker.id },
    data: { cardRating: 78 },
  });

  await prisma.gamertagHistory.upsert({
    where: { id: 'demo-gamertag-neon' },
    create: {
      id: 'demo-gamertag-neon',
      userId: neonStriker.id,
      gamerTag: 'NeonStriker',
    },
    update: { gamerTag: 'NeonStriker' },
  });

  // --- EA Pro Clubs demo: No Hope vs Amity (автоимпорт из EA API) ---
  async function seedEaDemoPlayer(
    email: string,
    nickname: string,
    gamerTag: string,
    position: PlayerPosition = PlayerPosition.CM,
  ) {
    return prisma.user.upsert({
      where: { email },
      update: {
        profile: {
          upsert: {
            create: {
              nickname,
              gamerTag,
              gamerTagConfirmed: true,
              primaryPosition: position,
              country: 'Россия',
              countryCode: 'RU',
            },
            update: { nickname, gamerTag, gamerTagConfirmed: true, primaryPosition: position },
          },
        },
      },
      create: {
        email,
        passwordHash,
        profile: {
          create: {
            nickname,
            gamerTag,
            gamerTagConfirmed: true,
            primaryPosition: position,
            country: 'Россия',
            countryCode: 'RU',
          },
        },
        stats: { create: { rating: 1700, wins: 0, losses: 0, tournamentsPlayed: 0, totalEarnings: 0 } },
        accounts: { create: { provider: AuthProvider.EMAIL, providerAccountId: email } },
      },
    });
  }

  const noHopePlayers = await Promise.all([
    seedEaDemoPlayer('nh-kras@demo.pitchzone.gg', 'NH_Kras', 'NH_Kras', PlayerPosition.ST),
    seedEaDemoPlayer('zlosem@demo.pitchzone.gg', 'Zlosem', 'Zlosem', PlayerPosition.CB),
    seedEaDemoPlayer('vetal@demo.pitchzone.gg', '7777VeTaL7777', '7777VeTaL7777', PlayerPosition.CM),
    seedEaDemoPlayer('hax@demo.pitchzone.gg', 'HA_HAX_TBAPb', 'HA_HAX_TBAPb', PlayerPosition.ST),
    seedEaDemoPlayer('ziby@demo.pitchzone.gg', 'Ziby83', 'Ziby83', PlayerPosition.CB),
    seedEaDemoPlayer('sempliq@demo.pitchzone.gg', 'S3mpliQ', '_S3mpliQ_', PlayerPosition.CDM),
    seedEaDemoPlayer('nur@demo.pitchzone.gg', 'Nur_sultan_08', 'Nur_sultan_08', PlayerPosition.CM),
    seedEaDemoPlayer('neewho@demo.pitchzone.gg', 'NeeWhoYamba', 'NeeWhoYamba', PlayerPosition.LW),
    seedEaDemoPlayer('figase@demo.pitchzone.gg', 'figase84', 'figase84', PlayerPosition.RW),
    seedEaDemoPlayer('rauf@demo.pitchzone.gg', 'Rauf_tkm', 'Rauf_tkm', PlayerPosition.CB),
    seedEaDemoPlayer('sacred@demo.pitchzone.gg', 'sacred1288', 'sacred1288', PlayerPosition.GK),
  ]);

  const amityPlayers = await Promise.all([
    seedEaDemoPlayer('amity-yankel@demo.pitchzone.gg', 'Amity_Yankel', 'Amity_Yankel', PlayerPosition.ST),
    seedEaDemoPlayer('shun23@demo.pitchzone.gg', 'Shun23', 'Shun23', PlayerPosition.CM),
    seedEaDemoPlayer('keyni@demo.pitchzone.gg', 'KeyNi_23', 'KeyNi_23', PlayerPosition.CAM),
    seedEaDemoPlayer('teyk@demo.pitchzone.gg', 'TEYK-III', 'TEYK-III', PlayerPosition.LW),
    seedEaDemoPlayer('nyambi@demo.pitchzone.gg', 'NyambI4', 'NyambI4', PlayerPosition.RW),
    seedEaDemoPlayer('friendlinho@demo.pitchzone.gg', 'Friendlinho', 'Friendlinho', PlayerPosition.CB),
    seedEaDemoPlayer('wonga@demo.pitchzone.gg', 'b1ll1-wonga', 'b1ll1-wonga', PlayerPosition.CDM),
    seedEaDemoPlayer('mola@demo.pitchzone.gg', 'molaNinho', 'molaNinho', PlayerPosition.ST),
    seedEaDemoPlayer('arva@demo.pitchzone.gg', 'ArVa__66', 'ArVa__66', PlayerPosition.CB),
    seedEaDemoPlayer('hron@demo.pitchzone.gg', 'Hron89', '-Hron89-', PlayerPosition.CM),
    seedEaDemoPlayer('icicle@demo.pitchzone.gg', 'unpaved_icicle3', 'unpaved_icicle3', PlayerPosition.GK),
  ]);

  const noHopeTeam = await prisma.team.upsert({
    where: { tag: 'NHOP' },
    update: { name: 'No Hope' },
    create: {
      name: 'No Hope',
      tag: 'NHOP',
      country: 'Россия',
      countryCode: 'RU',
      description: 'Pro Clubs — EA FC (демо автоимпорта)',
      ownerId: noHopePlayers[0].id,
      members: {
        create: noHopePlayers.map((u, i) => ({
          userId: u.id,
          role: i === 0 ? TeamRole.OWNER : TeamRole.MEMBER,
        })),
      },
    },
  });

  const amityTeam = await prisma.team.upsert({
    where: { tag: 'AMTY' },
    update: { name: 'Amity' },
    create: {
      name: 'Amity',
      tag: 'AMTY',
      country: 'Россия',
      countryCode: 'RU',
      description: 'Pro Clubs — EA FC (демо автоимпорта)',
      ownerId: amityPlayers[0].id,
      members: {
        create: amityPlayers.map((u, i) => ({
          userId: u.id,
          role: i === 0 ? TeamRole.OWNER : TeamRole.MEMBER,
        })),
      },
    },
  });

  // Ensure members exist on re-seed
  for (const [teamId, users] of [
    [noHopeTeam.id, noHopePlayers],
    [amityTeam.id, amityPlayers],
  ] as const) {
    for (const [i, user] of users.entries()) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: user.id } },
        create: {
          teamId,
          userId: user.id,
          role: i === 0 ? TeamRole.OWNER : TeamRole.MEMBER,
        },
        update: {},
      });
    }
  }

  const eaDemoSeason = await prisma.season.upsert({
    where: { id: 'demo-season-ea' },
    create: {
      id: 'demo-season-ea',
      name: 'EA Pro Clubs — демо-лига',
      type: SeasonType.REGULAR,
      year: demoYear,
      calendarSlot: 'AUTUMN_WINTER',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-12-31'),
      status: SeasonStatus.ACTIVE,
      hasDivisions: false,
      entryFee: 0,
      lanPointsWeight: 1.0,
      isPublic: false,
    },
    update: { status: SeasonStatus.ACTIVE, isPublic: false },
  });

  const eaDemoDivision = await prisma.division.upsert({
    where: {
      seasonId_name_groupLabel: { seasonId: eaDemoSeason.id, name: DivisionTier.NONE, groupLabel: '' },
    },
    create: { seasonId: eaDemoSeason.id, name: DivisionTier.NONE, tierOrder: 0 },
    update: {},
  });

  for (const [teamId, managerId] of [
    [noHopeTeam.id, noHopePlayers[0].id],
    [amityTeam.id, amityPlayers[0].id],
  ] as const) {
    await prisma.seasonTeamEntry.upsert({
      where: { seasonId_teamId: { seasonId: eaDemoSeason.id, teamId } },
      create: {
        seasonId: eaDemoSeason.id,
        divisionId: eaDemoDivision.id,
        teamId,
        managerId,
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      },
      update: {},
    });
  }

  const eaDemoMatch = await prisma.seasonMatch.upsert({
    where: { id: 'demo-ea-match-nhope-amity' },
    create: {
      id: 'demo-ea-match-nhope-amity',
      seasonId: eaDemoSeason.id,
      divisionId: eaDemoDivision.id,
      roundNumber: 1,
      weekLabel: 'Тур 1 — EA Sync',
      homeTeamId: noHopeTeam.id,
      awayTeamId: amityTeam.id,
      status: SeasonMatchStatus.SCHEDULED,
      playedAt: new Date('2026-08-11T20:12:41.000Z'),
    },
    update: {
      playedAt: new Date('2026-08-11T20:12:41.000Z'),
      homeTeamId: noHopeTeam.id,
      awayTeamId: amityTeam.id,
      eaMatchId: null,
      homeScore: null,
      awayScore: null,
      status: SeasonMatchStatus.SCHEDULED,
    },
  });

  // Clear prior EA import stats so re-seed + poll can run again
  await prisma.playerMatchStat.deleteMany({ where: { seasonMatchId: eaDemoMatch.id } });
  await prisma.eaApiMatchImport.deleteMany({
    where: {
      OR: [
        { eaClubLink: { teamId: noHopeTeam.id } },
        { eaClubLink: { teamId: amityTeam.id } },
      ],
    },
  });

  await prisma.eaClubLink.upsert({
    where: { teamId: noHopeTeam.id },
    create: {
      teamId: noHopeTeam.id,
      eaClubId: '7674',
      platform: EaClubPlatform.PS,
    },
    update: { eaClubId: '7674', platform: EaClubPlatform.PS },
  });

  await prisma.eaClubLink.upsert({
    where: { teamId: amityTeam.id },
    create: {
      teamId: amityTeam.id,
      eaClubId: '66373',
      platform: EaClubPlatform.PS,
    },
    update: { eaClubId: '66373', platform: EaClubPlatform.PS },
  });

  const pickupScheduled = new Date();
  pickupScheduled.setDate(pickupScheduled.getDate() + 3);
  pickupScheduled.setHours(20, 0, 0, 0);

  const demoPickup = await prisma.pickupMatch.upsert({
    where: { id: 'demo-pickup-1' },
    create: {
      id: 'demo-pickup-1',
      title: 'Сборная PitchZone — вечерняя scrimmage',
      description:
        'Открытый матч для новичков. Запишитесь, приходите в Discord — модератор соберёт состав.',
      scheduledAt: pickupScheduled,
      maxPlayers: 11,
      platform: 'PC / PS5',
      chatUrl: 'https://discord.gg/pitchzone-demo',
      createdById: modUser.id,
    },
    update: {
      scheduledAt: pickupScheduled,
      status: 'OPEN',
    },
  });

  console.log('Seed completed:');
  console.log(`  Players: NeonStriker (${neonStriker.id})`);
  console.log(`  Moderator: mod@pitchzone.gg (${modUser.id})`);
  console.log(`  Admin: admin@pitchzone.gg (${adminUser.id})`);
  console.log(
    `  Tournaments: ${winterCup.slug}, ${neonLeague.slug}, ${rapidCup.slug}, ${privateDuel.slug}`,
  );
  console.log('  Private duel invite: /tournaments/private-duel-demo?invite=demo-private-invite-token');
  console.log('  Demo password: demo12345');
  console.log(`  Seasons: ${firstSeason.id} (finished), ${secondSeason.id} (registration)`);
  console.log(`  StatTracker demo match: ${demoMatch.id}`);
  console.log(`  EA demo season: ${eaDemoSeason.id} — match ${eaDemoMatch.id} (No Hope vs Amity)`);
  console.log('  Run EA import: npm run seed:ea-poll');
  console.log(`  Match preview: /seasons/matches/${eaDemoMatch.id}`);
  console.log(`  Pickup match: ${demoPickup.id} (${demoPickup.title})`);

  const awardDefs = [
    {
      slug: 'totw-selection',
      name: 'Team of the Week',
      description: 'Попадание в символическую сборку недели',
      category: AwardCategory.SYMBOLIC_TEAM,
      iconEmoji: '⭐',
    },
    {
      slug: 'season-debut',
      name: 'Дебют сезона',
      description: 'Первый официальный матч в сезоне платформы',
      category: AwardCategory.INDIVIDUAL,
      iconEmoji: '🎽',
    },
    {
      slug: 'platform-early',
      name: 'Ранний участник',
      description: 'Регистрация в первые месяцы PitchZone',
      category: AwardCategory.SPECIAL,
      iconEmoji: '🚀',
    },
  ];

  for (const def of awardDefs) {
    const award = await prisma.award.upsert({
      where: { slug: def.slug },
      create: def,
      update: def,
    });

    await prisma.userAward.upsert({
      where: { id: `demo-award-${def.slug}-neon` },
      create: {
        id: `demo-award-${def.slug}-neon`,
        userId: neonStriker.id,
        awardId: award.id,
        awardedForText:
          def.slug === 'totw-selection'
            ? 'Неделя 12 — Осень-зима (демо)'
            : def.slug === 'season-debut'
              ? 'Матч demo-season-match-1'
              : 'PitchZone Founders',
        isPinned: def.slug !== 'platform-early',
      },
      update: { isPinned: def.slug !== 'platform-early' },
    });
  }

  await prisma.playerProfileExtra.upsert({
    where: { userId: neonStriker.id },
    create: {
      userId: neonStriker.id,
      fullName: 'Алексей Неонов',
      secondaryPositions: [PlayerPosition.CF, PlayerPosition.LW],
    },
    update: {
      fullName: 'Алексей Неонов',
      secondaryPositions: [PlayerPosition.CF, PlayerPosition.LW],
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
