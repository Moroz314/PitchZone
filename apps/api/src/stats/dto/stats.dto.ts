import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class CreateSeasonMatchDto {
  @IsString()
  seasonId!: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  roundNumber?: number;

  @IsOptional()
  @IsString()
  weekLabel?: string;

  @IsString()
  homeTeamId!: string;

  @IsString()
  awayTeamId!: string;

  @IsOptional()
  @IsDateString()
  playedAt?: string;
}

export class CompleteSeasonMatchDto {
  @IsInt()
  @Min(0)
  homeScore!: number;

  @IsInt()
  @Min(0)
  awayScore!: number;

  @IsOptional()
  @IsDateString()
  playedAt?: string;
}

export class PlayerStatEntryDto {
  @IsString()
  userId!: string;

  @IsEnum(PlayerPosition)
  positionPlayed!: PlayerPosition;

  @IsNumber()
  @Min(0)
  @Max(100)
  passAccuracy!: number;

  @IsInt()
  @Min(0)
  dribbles!: number;

  @IsInt()
  @Min(0)
  tacklesWon!: number;

  @IsInt()
  @Min(0)
  goals!: number;

  @IsInt()
  @Min(0)
  assists!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  saves?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  interceptions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fouls?: number;

  @IsOptional()
  @IsBoolean()
  cleanSheet?: boolean;

  @IsOptional()
  @IsObject()
  otherMetrics?: Record<string, unknown>;
}

export class SubmitMatchStatsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerStatEntryDto)
  players!: PlayerStatEntryDto[];
}

export class TotwSelectionDto {
  @IsInt()
  @Min(1)
  weekNumber!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TotwSlotDto)
  slots!: TotwSlotDto[];
}

export class TotwSlotDto {
  @IsEnum(PlayerPosition)
  positionSlot!: PlayerPosition;

  @IsString()
  userId!: string;
}

export class TotsSelectionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TotwSlotDto)
  slots!: TotwSlotDto[];
}

export class RecalculateRatingsDto {
  @IsString()
  seasonId!: string;
}
