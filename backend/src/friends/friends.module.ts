import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { FriendRequestsService } from './friend-requests.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [ProfileModule],
  controllers: [FriendsController],
  providers: [FriendsService, FriendRequestsService],
})
export class FriendsModule {}
