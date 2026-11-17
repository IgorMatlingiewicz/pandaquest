import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsTimeZone,
  MinLength,
} from 'class-validator';
import { SIGN_UP_LANGUAGES, type SignUpLanguage } from '../default-categories';
import { IsNewPassword } from '../password';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsNewPassword()
  password!: string;

  // IANA name, e.g. "Europe/Warsaw".
  @IsOptional()
  @IsString()
  @IsTimeZone()
  timezone?: string;

  // The app's language at sign-up: the example categories and tasks are
  // written in it. Left out by older apps, which get Polish as before.
  @IsOptional()
  @IsIn(SIGN_UP_LANGUAGES)
  language?: SignUpLanguage;
}
