import {
  IsEmail,
  IsOptional,
  IsString,
  IsTimeZone,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // IANA name, e.g. "Europe/Warsaw".
  @IsOptional()
  @IsString()
  @IsTimeZone()
  timezone?: string;
}
