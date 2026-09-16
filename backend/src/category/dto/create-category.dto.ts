import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { CategoryColor } from '../../generated/prisma/client';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsEnum(CategoryColor)
  color?: CategoryColor;
}
