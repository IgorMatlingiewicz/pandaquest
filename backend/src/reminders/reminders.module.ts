import { Module } from '@nestjs/common';
import { REMINDERS_CLOCK, systemClock } from './reminders.clock';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [RemindersController],
  providers: [
    RemindersService,
    { provide: REMINDERS_CLOCK, useValue: systemClock },
  ],
})
export class RemindersModule {}
