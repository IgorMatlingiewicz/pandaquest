import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateFavoriteBadgesDto } from './dto/update-favorite-badges.dto';
import { ProfileService } from './profile.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; email: string };
}

// Only the user's own profile: whose comes from the token alone.
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.profileService.getProfile(req.user.userId);
  }

  /** PUT: the body is the whole showcase, so sending it twice is harmless. */
  @Put('favorite-badges')
  setFavorites(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateFavoriteBadgesDto,
  ) {
    return this.profileService.setFavorites(req.user.userId, dto);
  }
}
