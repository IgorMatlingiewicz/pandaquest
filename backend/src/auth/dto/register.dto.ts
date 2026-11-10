import {
  IsEmail,
  IsOptional,
  IsString,
  IsTimeZone,
  MinLength,
} from 'class-validator';
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
}
