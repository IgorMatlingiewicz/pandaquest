import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProfileModule } from '../profile/profile.module';
import { FriendRequestsService } from './friend-requests.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FRIEND_REQUEST_RATE } from './friends.config';

@Module({
  imports: [
    ProfileModule,
    // ThrottlerModule is global and may be set up only once. It sits here
    // as sending friend requests is the only limited route; when a second
    // module needs a limit, move it to AppModule. The limit applies only
    // where UserThrottlerGuard is put, not to the whole API. The message is
    // for the logs, as in friend-errors.ts; the app goes by the 429.
    ThrottlerModule.forRoot({
      throttlers: [FRIEND_REQUEST_RATE],
      errorMessage: 'Za dużo prób, spróbuj za chwilę',
    }),
  ],
  controllers: [FriendsController],
  providers: [FriendsService, FriendRequestsService],
})
export class FriendsModule {}
