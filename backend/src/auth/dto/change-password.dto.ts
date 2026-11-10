import { IsString } from 'class-validator';
import { IsNewPassword } from '../password';

export class ChangePasswordDto {
  // Only a string, as at login: a wrong one is a 403 from the service, and
  // telling which rule it breaks would say something about the real password.
  @IsString()
  currentPassword!: string;

  @IsNewPassword()
  newPassword!: string;
}
