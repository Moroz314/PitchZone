import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthProvider } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(3)
  nickname!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class OAuthSyncDto {
  @IsEnum(AuthProvider)
  provider!: AuthProvider;

  @IsString()
  providerAccountId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class SteamTokenDto {
  @IsString()
  token!: string;
}
