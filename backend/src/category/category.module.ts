import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [BadgesModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
