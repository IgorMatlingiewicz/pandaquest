import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [BadgesModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
