import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { BadgesService } from './badges.service';

@Module({
  controllers: [AchievementsController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
