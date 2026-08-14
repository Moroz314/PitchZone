import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class CreatePlayerTransferAdDto {
  @IsEnum(PlayerPosition)
  position!: PlayerPosition;

  @IsArray()
  @IsString({ each: true })
  availableDays!: string[];

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  aboutText!: string;
}

export class CreateClubTransferAdDto {
  @IsEnum(PlayerPosition)
  positionNeeded!: PlayerPosition;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  requirementsText!: string;
}

export class OfferContractDto {
  @IsString()
  nickname!: string;

  @IsOptional()
  durationMonths?: number;

  @IsOptional()
  buyoutFee?: number;
}
