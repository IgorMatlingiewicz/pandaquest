import { Module } from '@nestjs/common';
import { FriendRequestsService } from './friend-requests.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  controllers: [FriendsController],
  providers: [FriendsService, FriendRequestsService],
})
export class FriendsModule {}
