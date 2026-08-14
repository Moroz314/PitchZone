import { DisputeStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

const RESOLUTIONS = [
  DisputeStatus.RESOLVED_A,
  DisputeStatus.RESOLVED_B,
  DisputeStatus.REJECTED,
] as const;

const SCORE_RESOLUTIONS = [DisputeStatus.RESOLVED_A, DisputeStatus.RESOLVED_B] as const;

export class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  resolution!: DisputeStatus;

  @ValidateIf((o: ResolveDisputeDto) =>
    SCORE_RESOLUTIONS.includes(o.resolution as (typeof SCORE_RESOLUTIONS)[number]),
  )
  @Type(() => Number)
  @IsInt()
  @Min(0)
  score1?: number;

  @ValidateIf((o: ResolveDisputeDto) =>
    SCORE_RESOLUTIONS.includes(o.resolution as (typeof SCORE_RESOLUTIONS)[number]),
  )
  @Type(() => Number)
  @IsInt()
  @Min(0)
  score2?: number;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class ReviewDisputeDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export { RESOLUTIONS };
