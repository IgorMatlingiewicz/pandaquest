import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { TaskModule } from './task/task.module';
import { BadgesModule } from './badges/badges.module';
import { StreakGoalsModule } from './streak-goals/streak-goals.module';
import { StatsModule } from './stats/stats.module';
import { ProfileModule } from './profile/profile.module';
import { FriendsModule } from './friends/friends.module';
import { TutorialModule } from './tutorial/tutorial.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CategoryModule,
    TaskModule,
    BadgesModule,
    StreakGoalsModule,
    StatsModule,
    ProfileModule,
    FriendsModule,
    TutorialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
