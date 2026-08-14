import { IsEnum, IsInt, Min } from 'class-validator';
import { WithdrawalMethod } from '@prisma/client';

export class WithdrawDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(WithdrawalMethod)
  method!: WithdrawalMethod;
}
