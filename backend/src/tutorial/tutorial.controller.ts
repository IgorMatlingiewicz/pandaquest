import { Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TutorialService } from './tutorial.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

// Always the token's user: no id in the path or the body. The status is
// read with the rest of the user, from GET /auth/me.
@UseGuards(JwtAuthGuard)
@Controller('tutorial')
export class TutorialController {
  constructor(private readonly tutorialService: TutorialService) {}

  // 200, not POST's default 201: nothing is created, a status changes, or
  // stays as it was when the move does not apply.
  @Post('dismiss')
  @HttpCode(200)
  dismiss(@Request() req: AuthenticatedRequest) {
    return this.tutorialService.dismiss(req.user.userId);
  }
}
