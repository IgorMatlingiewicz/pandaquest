import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { STREAK_GOAL_NAME_MAX_LENGTH } from '../streak-goals.config';

export class CreateStreakGoalDto {
  // Only the validated copy is trimmed: without `transform: true` the
  // ValidationPipe passes on the original body, so the service trims again.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(STREAK_GOAL_NAME_MAX_LENGTH)
  name!: string;
}
