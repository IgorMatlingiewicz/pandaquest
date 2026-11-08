import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** No parameters: whose statistics comes from the token alone. */
  @Get()
  getStats(@Request() req: AuthenticatedRequest) {
    return this.statsService.getStats(req.user.userId);
  }
}
