import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  MinLength,
} from 'class-validator';
import { TaskType, CompletionMode } from '../../generated/prisma/client';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsEnum(CompletionMode)
  completionMode?: CompletionMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  progressTarget?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
