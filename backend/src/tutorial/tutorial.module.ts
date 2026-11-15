import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { TutorialController } from './tutorial.controller';
import { TutorialService } from './tutorial.service';

@Module({
  imports: [BadgesModule],
  controllers: [TutorialController],
  providers: [TutorialService],
})
export class TutorialModule {}
