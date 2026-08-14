import { IsString, MinLength } from 'class-validator';

export class InviteTeamDto {
  @IsString()
  @MinLength(2)
  nickname!: string;
}

export class AcceptInviteDto {
  @IsString()
  inviteId!: string;
}
