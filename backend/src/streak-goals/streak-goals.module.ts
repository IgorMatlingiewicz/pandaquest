import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { StreakGoalsController } from './streak-goals.controller';
import { StreakGoalsService } from './streak-goals.service';

@Module({
  imports: [BadgesModule],
  controllers: [StreakGoalsController],
  providers: [StreakGoalsService],
})
export class StreakGoalsModule {}
