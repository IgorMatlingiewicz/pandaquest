import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';
import { TaskStatus } from '../../generated/prisma/client';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  progressCurrent?: number;
}
