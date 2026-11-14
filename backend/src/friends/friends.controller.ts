import {
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

// Whose code, requests and friends: always the token's user, never an id
// from the body or the path.
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

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
}
