import { IsEmail, IsOptional, IsString, IsTimeZone } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  // IANA name, e.g. "Europe/Warsaw".
  @IsOptional()
  @IsString()
  @IsTimeZone()
  timezone?: string;
}
