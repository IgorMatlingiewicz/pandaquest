import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { STREAK_GOAL_NAME_MAX_LENGTH } from '../streak-goals.config';

export class CreateStreakGoalDto {
  // With whitelist on, the ValidationPipe hands on the validated copy, so
  // the name arrives trimmed. The service trims again all the same: it is
  // the one that writes it, and it is also called without the pipe.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(STREAK_GOAL_NAME_MAX_LENGTH)
  name!: string;
}
