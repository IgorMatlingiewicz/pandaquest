import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';

export class ReorderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  order!: number;
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
