import { IsHexColor, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateClubDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5)
  tag!: string;

  @IsString()
  @MinLength(2)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsUrl()
  vkGroupUrl?: string;

  @IsOptional()
  @IsUrl()
  twitchUrl?: string;

  @IsOptional()
  @IsUrl()
  youtubeUrl?: string;

  @IsHexColor()
  primaryColor!: string;

  @IsHexColor()
  secondaryColor!: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsString()
  kitTemplateId!: string;
}
