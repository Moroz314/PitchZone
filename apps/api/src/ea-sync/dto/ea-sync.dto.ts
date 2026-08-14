import { IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { EaClubPlatform } from '@prisma/client';

export class UpdateEaClubLinkDto {
  @IsString()
  @MinLength(1)
  @Matches(/^\d+$/, { message: 'EA Club ID должен содержать только цифры' })
  eaClubId!: string;

  @IsEnum(EaClubPlatform)
  platform!: EaClubPlatform;
}
