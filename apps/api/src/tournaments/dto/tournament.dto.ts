import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GameTitle,
  MatchFormat,
  MatchStatus,
  PrizePoolType,
  ProofRequirement,
  TournamentFormat,
  TournamentStatus,
  TournamentVisibility,
} from '@prisma/client';

export class PrizePlaceDto {
  @IsInt()
  @Min(1)
  place!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;
}

export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsEnum(GameTitle)
  game?: GameTitle;

  @IsOptional()
  @IsEnum(TournamentFormat)
  format?: TournamentFormat;

  @IsOptional()
  @IsEnum(MatchFormat)
  matchFormat?: MatchFormat;

  @IsOptional()
  @IsInt()
  @Min(1)
  teamSize?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  minParticipants?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @IsOptional()
  @IsEnum(PrizePoolType)
  prizePoolType?: PrizePoolType;

  @IsOptional()
  @IsInt()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fixedPrizePool?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  platformCommissionPercent?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrizePlaceDto)
  prizeDistribution?: PrizePlaceDto[];

  @IsOptional()
  @IsString()
  rulesText?: string;

  @IsOptional()
  @IsEnum(ProofRequirement)
  proofRequirement?: ProofRequirement;

  @IsOptional()
  @IsEnum(TournamentVisibility)
  visibility?: TournamentVisibility;

  @IsOptional()
  @IsString()
  bannerGradient?: string;
}

export class UpdateTournamentDto extends CreateTournamentDto {}

export class RegisterTournamentDto {
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  inviteToken?: string;
}

export class UpdateMatchDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  score1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  score2?: number;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}

export { TournamentStatus };
