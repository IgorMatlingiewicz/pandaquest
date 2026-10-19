import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BadgesService } from './badges.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly badgesService: BadgesService) {}

  /** Always the caller's own achievements: the user id comes from the token. */
  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.badgesService.getAchievements(req.user.userId);
  }
}
