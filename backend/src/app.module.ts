import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { createValidationPipe } from './common/validation-pipe';
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
import { RemindersModule } from './reminders/reminders.module';

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
    RemindersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Here and not in main.ts: everything that builds AppModule, the e2e
    // tests included, validates the same way.
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
