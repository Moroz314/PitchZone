import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class SeedEntryDto {
  @IsString()
  participantId!: string;

  @IsInt()
  @Min(1)
  seed!: number;
}

export class UpdateSeedsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => SeedEntryDto)
  seeds!: SeedEntryDto[];
}
