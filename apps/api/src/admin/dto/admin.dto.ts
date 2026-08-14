import { IsBoolean, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { TournamentStatus, UserRole } from '@prisma/client';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isStatTracker?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreateTournaments?: boolean;
}

export class AdminUpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  defaultPlatformCommissionPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  privateTournamentCreationFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32)
  lanQualifyTopN?: number;
}

export class AdminUpdateTournamentStatusDto {
  @IsEnum(TournamentStatus)
  status!: TournamentStatus;
}
