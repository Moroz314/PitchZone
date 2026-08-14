import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SeasonStatus, SeasonType } from '@prisma/client';

export class CreateSeasonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(SeasonType)
  type!: SeasonType;

  @IsInt()
  @Min(2020)
  year!: number;

  @IsOptional()
  @IsString()
  calendarSlot?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(SeasonStatus)
  status?: SeasonStatus;

  @IsBoolean()
  hasDivisions!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lanPointsWeight?: number;
}

export class UpdateSeasonDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(SeasonType)
  type?: SeasonType;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  calendarSlot?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(SeasonStatus)
  status?: SeasonStatus;

  @IsOptional()
  @IsBoolean()
  hasDivisions?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lanPointsWeight?: number;
}

export class PromotionRuleItemDto {
  @IsString()
  divisionId!: string;

  @IsInt()
  @Min(0)
  promoteTopN!: number;

  @IsInt()
  @Min(0)
  relegateBottomN!: number;
}

export class SetPromotionRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionRuleItemDto)
  rules!: PromotionRuleItemDto[];
}

export class UpdateSeasonEntryDto {
  @IsOptional()
  @IsInt()
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  matchesPlayed?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  wins?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  draws?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  losses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  goalsFor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  goalsAgainst?: number;
}

export class RegisterSeasonDto {
  @IsString()
  teamId!: string;
}

export class CalculateAnnualDto {
  @IsInt()
  @Min(2020)
  year!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  qualifyTopN?: number;
}
