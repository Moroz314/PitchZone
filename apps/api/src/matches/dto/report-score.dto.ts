import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ReportScoreDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  score1!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  score2!: number;
}
