import { IsOptional, IsString } from 'class-validator';

export class CreateTournamentInviteDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  teamTag?: string;
}
