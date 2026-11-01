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
import { CreateStreakGoalDto } from './dto/create-streak-goal.dto';
import { StreakGoalsService } from './streak-goals.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('streak-goals')
export class StreakGoalsController {
  constructor(private readonly streakGoalsService: StreakGoalsService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.streakGoalsService.findAll(req.user.userId);
  }

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateStreakGoalDto,
  ) {
    return this.streakGoalsService.create(req.user.userId, dto);
  }

  /** 200, not the POST default 201: this creates no new goal. */
  @Post('sync')
  @HttpCode(200)
  sync(@Request() req: AuthenticatedRequest) {
    return this.streakGoalsService.sync(req.user.userId);
  }

  /** 200, not the POST default 201: this creates no new goal. */
  @Post(':id/relapse')
  @HttpCode(200)
  relapse(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.streakGoalsService.relapse(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.streakGoalsService.remove(req.user.userId, id);
  }
}
