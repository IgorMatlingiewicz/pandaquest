import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService],
  // A friend's profile is computed the same way, then cut down to the
  // fields friends may see.
  exports: [ProfileService],
})
export class ProfileModule {}
