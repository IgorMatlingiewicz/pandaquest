import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';
import { MAX_REMINDERS } from '../reminders.config';
import { REMINDER_KEY_PATTERN } from '../reminders.logic';

export class AckRemindersDto {
  // At most what one GET returns, so whatever the app was shown it confirms
  // in one call. An empty list is a bug in the caller, not a no-op. Any
  // invalid key refuses the whole request: nothing is half saved.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_REMINDERS)
  @IsString({ each: true })
  @Matches(REMINDER_KEY_PATTERN, { each: true })
  keys!: string[];
}
