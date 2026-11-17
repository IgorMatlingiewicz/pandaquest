import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AckRemindersDto } from './dto/ack-reminders.dto';
import { RemindersService } from './reminders.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /** No parameters: whose reminders comes from the token alone. */
  @Get()
  getReminders(@Request() req: AuthenticatedRequest) {
    return this.remindersService.getReminders(req.user.userId);
  }

  /** The app showed these; nothing to send back, hence 204. */
  @Post('ack')
  @HttpCode(204)
  ack(@Request() req: AuthenticatedRequest, @Body() dto: AckRemindersDto) {
    return this.remindersService.ack(req.user.userId, dto.keys);
  }
}
