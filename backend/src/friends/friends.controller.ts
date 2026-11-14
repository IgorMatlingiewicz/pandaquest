import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendRequestsService } from './friend-requests.service';
import { FriendsService } from './friends.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

// Whose code, requests and friends: always the token's user, never an id
// from the body or the path. An id in the path names a request, and the
// service checks the user is the one allowed to act on it.
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly requestsService: FriendRequestsService,
  ) {}

  @Get('code')
  getCode(@Request() req: AuthenticatedRequest) {
    return this.friendsService.getCode(req.user.userId);
  }

  // 200, not POST's default 201: nothing new is created, a value changes.
  @Post('code/regenerate')
  @HttpCode(200)
  regenerateCode(@Request() req: AuthenticatedRequest) {
    return this.friendsService.regenerateCode(req.user.userId);
  }

  @Get('summary')
  summary(@Request() req: AuthenticatedRequest) {
    return this.requestsService.summary(req.user.userId);
  }

  @Post('requests')
  sendRequest(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.requestsService.send(req.user.userId, dto.code);
  }

  @Get('requests')
  listRequests(@Request() req: AuthenticatedRequest) {
    return this.requestsService.list(req.user.userId);
  }

  // 200: an answer changes a request, it creates nothing.
  @Post('requests/:id/accept')
  @HttpCode(200)
  acceptRequest(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.requestsService.accept(req.user.userId, id);
  }

  @Post('requests/:id/decline')
  @HttpCode(200)
  declineRequest(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.requestsService.decline(req.user.userId, id);
  }

  // 204: the request is gone and there is nothing to send back.
  @Delete('requests/:id')
  @HttpCode(204)
  cancelRequest(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.requestsService.cancel(req.user.userId, id);
  }

  @Get()
  listFriends(@Request() req: AuthenticatedRequest) {
    return this.friendsService.list(req.user.userId);
  }

  // A friend is addressed by the friendship's id, never by their user id:
  // the service then checks the token's user is on that friendship.
  @Get(':friendshipId/profile')
  friendProfile(
    @Request() req: AuthenticatedRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendsService.profile(req.user.userId, friendshipId);
  }

  @Get(':friendshipId/badges')
  friendBadges(
    @Request() req: AuthenticatedRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendsService.badges(req.user.userId, friendshipId);
  }

  @Delete(':friendshipId')
  @HttpCode(204)
  removeFriend(
    @Request() req: AuthenticatedRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendsService.remove(req.user.userId, friendshipId);
  }
}
