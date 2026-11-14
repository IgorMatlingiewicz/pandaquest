import { IsString } from 'class-validator';

export class SendFriendRequestDto {
  // Only "is it text": any text that is not a known code, a malformed one
  // included, gets the same 404 from the service, so the answer never says
  // which codes exist.
  @IsString()
  code!: string;
}
