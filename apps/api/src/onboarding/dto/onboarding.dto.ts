import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class CompleteOnboardingProfileDto {
  @IsString()
  @MinLength(3)
  @MaxLength(16)
  gamerTag!: string;

  @IsBoolean()
  gamerTagConfirmed!: boolean;

  @IsEnum(PlayerPosition)
  primaryPosition!: PlayerPosition;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsUrl()
  vkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegramUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  discordUsername?: string;
}

export class CreatePickupMatchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsUrl()
  chatUrl?: string;
}

export class RegisterPickupMatchDto {
  @IsOptional()
  @IsEnum(PlayerPosition)
  position?: PlayerPosition;
}
