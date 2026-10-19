import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { TaskModule } from './task/task.module';
import { BadgesModule } from './badges/badges.module';

@Module({
  imports: [PrismaModule, AuthModule, CategoryModule, TaskModule, BadgesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
