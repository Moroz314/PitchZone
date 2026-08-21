-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'DISCORD', 'STEAM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ORGANIZER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'CAPTAIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PlayerPosition" AS ENUM ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF');

-- CreateEnum
CREATE TYPE "TransferAdStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('REGULAR', 'OFFSEASON_FUN');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'REGISTRATION', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "DivisionTier" AS ENUM ('GOLD', 'SILVER', 'BRONZE', 'NONE');

-- CreateEnum
CREATE TYPE "TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'PENDING_MODERATION', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'LIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS');

-- CreateEnum
CREATE TYPE "GameTitle" AS ENUM ('EA_FC', 'EFOOTBALL', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('BO1', 'BO3', 'BO5');

-- CreateEnum
CREATE TYPE "PrizePoolType" AS ENUM ('FROM_FEES', 'FIXED_SPONSORED');

-- CreateEnum
CREATE TYPE "ProofRequirement" AS ENUM ('SCREENSHOT', 'VIDEO', 'BOTH');

-- CreateEnum
CREATE TYPE "TournamentVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TournamentInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'ENTRY_FEE_HOLD', 'ENTRY_FEE_REFUND', 'PRIZE_PAYOUT', 'PLATFORM_COMMISSION', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalMethod" AS ENUM ('CARD', 'BANK');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HOLDING', 'DISTRIBUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SeedingMode" AS ENUM ('BY_RATING', 'RANDOM');

-- CreateEnum
CREATE TYPE "MatchEaSyncStatus" AS ENUM ('AWAITING_EA', 'SYNCED', 'NEEDS_REVIEW', 'MANUAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'BYE', 'SCHEDULED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_A', 'RESOLVED_B', 'REJECTED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('USER', 'TEAM');

-- CreateEnum
CREATE TYPE "SeasonMatchStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupMatchStatus" AS ENUM ('OPEN', 'FULL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EaClubPlatform" AS ENUM ('PS', 'XBOX', 'PC');

-- CreateEnum
CREATE TYPE "EaApiImportStatus" AS ENUM ('IMPORTED', 'NEEDS_REVIEW', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AwardCategory" AS ENUM ('TEAM', 'INDIVIDUAL', 'MANAGEMENT', 'WEEKLY_CUP', 'SYMBOLIC_TEAM', 'SPECIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isStatTracker" BOOLEAN NOT NULL DEFAULT false,
    "canCreateTournaments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT,
    "country" TEXT,
    "countryCode" VARCHAR(2),
    "bio" TEXT,
    "gamerTag" TEXT,
    "gamerTagConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "primaryPosition" "PlayerPosition",
    "city" TEXT,
    "vkUrl" TEXT,
    "telegramUrl" TEXT,
    "discordUsername" TEXT,
    "profileCompletedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "cardRating" INTEGER NOT NULL DEFAULT 75,
    "totwCount" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tournamentsPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" VARCHAR(5) NOT NULL,
    "avatar" TEXT,
    "country" TEXT,
    "countryCode" VARCHAR(2),
    "description" TEXT,
    "vkGroupUrl" TEXT,
    "twitchUrl" TEXT,
    "youtubeUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1a1a2e',
    "secondaryColor" TEXT NOT NULL DEFAULT '#C6FF3D',
    "accentColor" TEXT,
    "kitTemplateId" TEXT,
    "coverBannerUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "renderType" TEXT NOT NULL DEFAULT 'SVG_LAYERED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KitTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTransferAd" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" "PlayerPosition" NOT NULL,
    "availableDays" JSONB NOT NULL,
    "aboutText" TEXT NOT NULL,
    "status" "TransferAdStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerTransferAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTransferAd" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "positionNeeded" "PlayerPosition" NOT NULL,
    "requirementsText" TEXT NOT NULL,
    "status" "TransferAdStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubTransferAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offeredByUserId" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "buyoutFee" INTEGER NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "game" "GameTitle" NOT NULL DEFAULT 'EA_FC',
    "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "matchFormat" "MatchFormat" NOT NULL DEFAULT 'BO1',
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "prizePool" INTEGER NOT NULL DEFAULT 0,
    "prizePoolType" "PrizePoolType" NOT NULL DEFAULT 'FROM_FEES',
    "fixedPrizePool" INTEGER,
    "prizeDistribution" JSONB NOT NULL DEFAULT '[{"place":1,"percent":100}]',
    "platformCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "maxParticipants" INTEGER NOT NULL,
    "minParticipants" INTEGER NOT NULL DEFAULT 2,
    "registrationDeadline" TIMESTAMP(3),
    "rulesText" TEXT,
    "proofRequirement" "ProofRequirement" NOT NULL DEFAULT 'SCREENSHOT',
    "visibility" "TournamentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "inviteToken" TEXT,
    "seedingMode" "SeedingMode" NOT NULL DEFAULT 'BY_RATING',
    "matchResultTimeoutHours" INTEGER NOT NULL DEFAULT 24,
    "bannerGradient" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "organizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentInvite" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "invitedTeamId" TEXT,
    "invitedByUserId" TEXT NOT NULL,
    "status" "TournamentInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentParticipant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "type" "ParticipantType" NOT NULL DEFAULT 'USER',
    "seed" INTEGER,
    "placement" INTEGER,
    "prizeAmount" INTEGER,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutSessionId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "relatedTournamentId" TEXT,
    "relatedParticipantId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "withdrawalMethod" "WithdrawalMethod",
    "failureReason" TEXT,
    "externalPaymentId" TEXT,
    "stripeSessionId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowAccount" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "totalHeld" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "EscrowStatus" NOT NULL DEFAULT 'HOLDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "participant1Id" TEXT,
    "participant2Id" TEXT,
    "participant1Name" TEXT,
    "participant2Name" TEXT,
    "score1" INTEGER,
    "score2" INTEGER,
    "winnerId" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "nextMatchId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "confirmationDeadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "eaMatchId" TEXT,
    "eaSyncStatus" "MatchEaSyncStatus" NOT NULL DEFAULT 'AWAITING_EA',
    "eaSyncNote" TEXT,
    "fallbackDeadline" TIMESTAMP(3),
    "fallbackAutoAcceptDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSubmission" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score1" INTEGER NOT NULL,
    "score2" INTEGER NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reasonText" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultPlatformCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "privateTournamentCreationFee" INTEGER NOT NULL DEFAULT 0,
    "lanQualifyTopN" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SeasonType" NOT NULL DEFAULT 'REGULAR',
    "year" INTEGER NOT NULL,
    "calendarSlot" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'UPCOMING',
    "hasDivisions" BOOLEAN NOT NULL DEFAULT false,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "lanPointsWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" "DivisionTier" NOT NULL,
    "groupLabel" TEXT NOT NULL DEFAULT '',
    "tierOrder" INTEGER NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonTeamEntry" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT,
    "teamId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "finalPosition" INTEGER,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonTeamEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRelegationRule" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "promoteTopN" INTEGER NOT NULL DEFAULT 0,
    "relegateBottomN" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PromotionRelegationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamertagHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gamerTag" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "GamertagHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnboardingProgress" (
    "userId" TEXT NOT NULL,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "pickupJoined" BOOLEAN NOT NULL DEFAULT false,
    "transfersVisited" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboardingProgress_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PickupMatch" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 11,
    "platform" TEXT,
    "chatUrl" TEXT,
    "status" "PickupMatchStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupMatchRegistration" (
    "id" TEXT NOT NULL,
    "pickupMatchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" "PlayerPosition",
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupMatchRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaClubLink" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eaClubId" TEXT NOT NULL,
    "platform" "EaClubPlatform" NOT NULL DEFAULT 'PC',
    "gameVersion" TEXT NOT NULL DEFAULT 'FC26',
    "lastVerifiedClubName" TEXT,
    "needsReverification" BOOLEAN NOT NULL DEFAULT false,
    "lastPolledAt" TIMESTAMP(3),
    "lastSyncedMatchEaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaClubLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaApiMatchImport" (
    "id" TEXT NOT NULL,
    "eaMatchId" TEXT NOT NULL,
    "eaClubLinkId" TEXT NOT NULL,
    "matchedSeasonMatchId" TEXT,
    "matchedTournamentMatchId" TEXT,
    "rawJson" JSONB NOT NULL,
    "importStatus" "EaApiImportStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "reviewNote" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaApiMatchImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMatch" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "weekLabel" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" "SeasonMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "playedAt" TIMESTAMP(3),
    "eaMatchId" TEXT,
    "eaSyncStatus" "MatchEaSyncStatus" NOT NULL DEFAULT 'AWAITING_EA',
    "eaSyncNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchStat" (
    "id" TEXT NOT NULL,
    "seasonMatchId" TEXT,
    "tournamentMatchId" TEXT,
    "userId" TEXT NOT NULL,
    "positionPlayed" "PlayerPosition" NOT NULL,
    "passAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dribbles" INTEGER NOT NULL DEFAULT 0,
    "tacklesWon" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "fouls" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,
    "otherMetrics" JSONB,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "enteredById" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerMatchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonXpSummary" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "rankInSeason" INTEGER,
    "eligibleForRecalculation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SeasonXpSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRatingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "baseRating" INTEGER NOT NULL,
    "totwBonus" INTEGER NOT NULL DEFAULT 0,
    "totsBonus" INTEGER NOT NULL DEFAULT 0,
    "finalRating" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamOfTheWeek" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "positionSlot" "PlayerPosition" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamOfTheWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamOfTheSeason" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "positionSlot" "PlayerPosition" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamOfTheSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualStanding" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "totalPointsAcrossSeasons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seasonsPlayed" INTEGER NOT NULL DEFAULT 0,
    "qualifiedForLan" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnualStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTournamentStat" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "passAccuracyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tacklesWon" INTEGER NOT NULL DEFAULT 0,
    "cleanSheets" INTEGER NOT NULL DEFAULT 0,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerTournamentStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamTournamentStat" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamTournamentStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfileExtra" (
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "birthDate" TIMESTAMP(3),
    "premiumUntil" TIMESTAMP(3),
    "secondaryPositions" "PlayerPosition"[],

    CONSTRAINT "PlayerProfileExtra_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PlayerCareerStat" (
    "userId" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "avgMatchRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "passAccuracyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successfulTackles" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "cleanSheets" INTEGER NOT NULL DEFAULT 0,
    "rankTotalMatches" INTEGER,
    "rankTotalXp" INTEGER,
    "rankAvgRating" INTEGER,
    "rankGoals" INTEGER,
    "rankAssists" INTEGER,
    "rankPassAccuracy" INTEGER,
    "rankTackles" INTEGER,
    "rankInterceptions" INTEGER,
    "rankCleanSheets" INTEGER,
    "recalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerCareerStat_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PlayerPositionStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" "PlayerPosition" NOT NULL,
    "positionGroup" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "percentOfTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgMatchRating" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerPositionStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AwardCategory" NOT NULL,
    "iconEmoji" TEXT NOT NULL DEFAULT '🏆',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "awardedForText" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAward" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "awardedForText" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_nickname_key" ON "Profile"("nickname");

-- CreateIndex
CREATE INDEX "Profile_gamerTag_idx" ON "Profile"("gamerTag");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStats_userId_key" ON "PlayerStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_tag_key" ON "Team"("tag");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_inviteeId_status_idx" ON "TeamInvite"("inviteeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_teamId_inviteeId_status_key" ON "TeamInvite"("teamId", "inviteeId", "status");

-- CreateIndex
CREATE INDEX "PlayerTransferAd_userId_idx" ON "PlayerTransferAd"("userId");

-- CreateIndex
CREATE INDEX "PlayerTransferAd_status_idx" ON "PlayerTransferAd"("status");

-- CreateIndex
CREATE INDEX "ClubTransferAd_teamId_idx" ON "ClubTransferAd"("teamId");

-- CreateIndex
CREATE INDEX "ClubTransferAd_status_idx" ON "ClubTransferAd"("status");

-- CreateIndex
CREATE INDEX "Contract_teamId_idx" ON "Contract"("teamId");

-- CreateIndex
CREATE INDEX "Contract_userId_idx" ON "Contract"("userId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_inviteToken_key" ON "Tournament"("inviteToken");

-- CreateIndex
CREATE INDEX "TournamentInvite_tournamentId_idx" ON "TournamentInvite"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentInvite_tournamentId_invitedUserId_key" ON "TournamentInvite"("tournamentId", "invitedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentInvite_tournamentId_invitedTeamId_key" ON "TournamentInvite"("tournamentId", "invitedTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_stripeCheckoutSessionId_key" ON "TournamentParticipant"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "TournamentParticipant_tournamentId_idx" ON "TournamentParticipant"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentParticipant_paymentStatus_idx" ON "TournamentParticipant"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_userId_key" ON "TournamentParticipant"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_teamId_key" ON "TournamentParticipant"("tournamentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_relatedTournamentId_idx" ON "Transaction"("relatedTournamentId");

-- CreateIndex
CREATE INDEX "Transaction_stripeSessionId_idx" ON "Transaction"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Transaction_externalPaymentId_idx" ON "Transaction"("externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAccount_tournamentId_key" ON "EscrowAccount"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_eaMatchId_key" ON "Match"("eaMatchId");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_tournamentId_round_position_key" ON "Match"("tournamentId", "round", "position");

-- CreateIndex
CREATE INDEX "MatchSubmission_matchId_idx" ON "MatchSubmission"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSubmission_matchId_participantId_key" ON "MatchSubmission"("matchId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_matchId_key" ON "Dispute"("matchId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Season_status_idx" ON "Season"("status");

-- CreateIndex
CREATE INDEX "Season_year_idx" ON "Season"("year");

-- CreateIndex
CREATE INDEX "Division_seasonId_idx" ON "Division"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Division_seasonId_name_groupLabel_key" ON "Division"("seasonId", "name", "groupLabel");

-- CreateIndex
CREATE INDEX "SeasonTeamEntry_seasonId_idx" ON "SeasonTeamEntry"("seasonId");

-- CreateIndex
CREATE INDEX "SeasonTeamEntry_teamId_idx" ON "SeasonTeamEntry"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonTeamEntry_seasonId_teamId_key" ON "SeasonTeamEntry"("seasonId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRelegationRule_seasonId_divisionId_key" ON "PromotionRelegationRule"("seasonId", "divisionId");

-- CreateIndex
CREATE INDEX "GamertagHistory_userId_idx" ON "GamertagHistory"("userId");

-- CreateIndex
CREATE INDEX "GamertagHistory_gamerTag_idx" ON "GamertagHistory"("gamerTag");

-- CreateIndex
CREATE INDEX "PickupMatch_status_scheduledAt_idx" ON "PickupMatch"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PickupMatchRegistration_userId_idx" ON "PickupMatchRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupMatchRegistration_pickupMatchId_userId_key" ON "PickupMatchRegistration"("pickupMatchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EaClubLink_teamId_key" ON "EaClubLink"("teamId");

-- CreateIndex
CREATE INDEX "EaClubLink_eaClubId_idx" ON "EaClubLink"("eaClubId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EaApiMatchImport_importStatus_idx" ON "EaApiMatchImport"("importStatus");

-- CreateIndex
CREATE INDEX "EaApiMatchImport_eaClubLinkId_idx" ON "EaApiMatchImport"("eaClubLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "EaApiMatchImport_eaMatchId_eaClubLinkId_key" ON "EaApiMatchImport"("eaMatchId", "eaClubLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMatch_eaMatchId_key" ON "SeasonMatch"("eaMatchId");

-- CreateIndex
CREATE INDEX "SeasonMatch_seasonId_idx" ON "SeasonMatch"("seasonId");

-- CreateIndex
CREATE INDEX "SeasonMatch_status_idx" ON "SeasonMatch"("status");

-- CreateIndex
CREATE INDEX "SeasonMatch_eaSyncStatus_idx" ON "SeasonMatch"("eaSyncStatus");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_userId_idx" ON "PlayerMatchStat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStat_seasonMatchId_userId_key" ON "PlayerMatchStat"("seasonMatchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStat_tournamentMatchId_userId_key" ON "PlayerMatchStat"("tournamentMatchId", "userId");

-- CreateIndex
CREATE INDEX "SeasonXpSummary_seasonId_totalXp_idx" ON "SeasonXpSummary"("seasonId", "totalXp");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonXpSummary_seasonId_userId_key" ON "SeasonXpSummary"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "PlayerRatingHistory_userId_idx" ON "PlayerRatingHistory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRatingHistory_userId_seasonId_key" ON "PlayerRatingHistory"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "TeamOfTheWeek_seasonId_weekNumber_idx" ON "TeamOfTheWeek"("seasonId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TeamOfTheWeek_seasonId_weekNumber_positionSlot_key" ON "TeamOfTheWeek"("seasonId", "weekNumber", "positionSlot");

-- CreateIndex
CREATE UNIQUE INDEX "TeamOfTheSeason_seasonId_positionSlot_key" ON "TeamOfTheSeason"("seasonId", "positionSlot");

-- CreateIndex
CREATE INDEX "AnnualStanding_year_idx" ON "AnnualStanding"("year");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualStanding_year_teamId_key" ON "AnnualStanding"("year", "teamId");

-- CreateIndex
CREATE INDEX "PlayerTournamentStat_userId_idx" ON "PlayerTournamentStat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTournamentStat_tournamentId_userId_key" ON "PlayerTournamentStat"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "TeamTournamentStat_teamId_idx" ON "TeamTournamentStat"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamTournamentStat_tournamentId_teamId_key" ON "TeamTournamentStat"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "PlayerPositionStat_userId_idx" ON "PlayerPositionStat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPositionStat_userId_position_key" ON "PlayerPositionStat"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Award_slug_key" ON "Award"("slug");

-- CreateIndex
CREATE INDEX "UserAward_userId_idx" ON "UserAward"("userId");

-- CreateIndex
CREATE INDEX "UserAward_awardId_idx" ON "UserAward"("awardId");

-- CreateIndex
CREATE INDEX "TeamAward_teamId_idx" ON "TeamAward"("teamId");

-- CreateIndex
CREATE INDEX "TeamAward_awardId_idx" ON "TeamAward"("awardId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_kitTemplateId_fkey" FOREIGN KEY ("kitTemplateId") REFERENCES "KitTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTransferAd" ADD CONSTRAINT "PlayerTransferAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTransferAd" ADD CONSTRAINT "ClubTransferAd_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_offeredByUserId_fkey" FOREIGN KEY ("offeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvite" ADD CONSTRAINT "TournamentInvite_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvite" ADD CONSTRAINT "TournamentInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvite" ADD CONSTRAINT "TournamentInvite_invitedTeamId_fkey" FOREIGN KEY ("invitedTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvite" ADD CONSTRAINT "TournamentInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedTournamentId_fkey" FOREIGN KEY ("relatedTournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedParticipantId_fkey" FOREIGN KEY ("relatedParticipantId") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowAccount" ADD CONSTRAINT "EscrowAccount_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSubmission" ADD CONSTRAINT "MatchSubmission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSubmission" ADD CONSTRAINT "MatchSubmission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TournamentParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSubmission" ADD CONSTRAINT "MatchSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTeamEntry" ADD CONSTRAINT "SeasonTeamEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTeamEntry" ADD CONSTRAINT "SeasonTeamEntry_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTeamEntry" ADD CONSTRAINT "SeasonTeamEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTeamEntry" ADD CONSTRAINT "SeasonTeamEntry_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRelegationRule" ADD CONSTRAINT "PromotionRelegationRule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRelegationRule" ADD CONSTRAINT "PromotionRelegationRule_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamertagHistory" ADD CONSTRAINT "GamertagHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnboardingProgress" ADD CONSTRAINT "UserOnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatch" ADD CONSTRAINT "PickupMatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchRegistration" ADD CONSTRAINT "PickupMatchRegistration_pickupMatchId_fkey" FOREIGN KEY ("pickupMatchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchRegistration" ADD CONSTRAINT "PickupMatchRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaClubLink" ADD CONSTRAINT "EaClubLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaApiMatchImport" ADD CONSTRAINT "EaApiMatchImport_eaClubLinkId_fkey" FOREIGN KEY ("eaClubLinkId") REFERENCES "EaClubLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaApiMatchImport" ADD CONSTRAINT "EaApiMatchImport_matchedSeasonMatchId_fkey" FOREIGN KEY ("matchedSeasonMatchId") REFERENCES "SeasonMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaApiMatchImport" ADD CONSTRAINT "EaApiMatchImport_matchedTournamentMatchId_fkey" FOREIGN KEY ("matchedTournamentMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStat" ADD CONSTRAINT "PlayerMatchStat_seasonMatchId_fkey" FOREIGN KEY ("seasonMatchId") REFERENCES "SeasonMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStat" ADD CONSTRAINT "PlayerMatchStat_tournamentMatchId_fkey" FOREIGN KEY ("tournamentMatchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStat" ADD CONSTRAINT "PlayerMatchStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStat" ADD CONSTRAINT "PlayerMatchStat_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonXpSummary" ADD CONSTRAINT "SeasonXpSummary_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonXpSummary" ADD CONSTRAINT "SeasonXpSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRatingHistory" ADD CONSTRAINT "PlayerRatingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRatingHistory" ADD CONSTRAINT "PlayerRatingHistory_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamOfTheWeek" ADD CONSTRAINT "TeamOfTheWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamOfTheWeek" ADD CONSTRAINT "TeamOfTheWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamOfTheSeason" ADD CONSTRAINT "TeamOfTheSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamOfTheSeason" ADD CONSTRAINT "TeamOfTheSeason_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualStanding" ADD CONSTRAINT "AnnualStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTournamentStat" ADD CONSTRAINT "PlayerTournamentStat_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTournamentStat" ADD CONSTRAINT "PlayerTournamentStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamTournamentStat" ADD CONSTRAINT "TeamTournamentStat_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamTournamentStat" ADD CONSTRAINT "TeamTournamentStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerProfileExtra" ADD CONSTRAINT "PlayerProfileExtra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCareerStat" ADD CONSTRAINT "PlayerCareerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPositionStat" ADD CONSTRAINT "PlayerPositionStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAward" ADD CONSTRAINT "UserAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAward" ADD CONSTRAINT "UserAward_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAward" ADD CONSTRAINT "TeamAward_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAward" ADD CONSTRAINT "TeamAward_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

