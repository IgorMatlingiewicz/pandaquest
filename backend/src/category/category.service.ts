import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    const count = await this.prisma.category.count({ where: { userId } });

    return this.prisma.category.create({
      data: {
        ...dto,
        userId,
        order: count,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('Kategoria nie znaleziona');
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(userId, id);

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    const taskCount = await this.prisma.task.count({
      where: { categoryId: id },
    });
    if (taskCount > 0) {
      throw new ConflictException(
        'Ta kategoria zawiera zadania — przenieś lub usuń je najpierw',
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }
}
