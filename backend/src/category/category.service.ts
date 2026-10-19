import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderItemDto } from '../common/dto/reorder.dto';
import { getPeriodEnd } from '../common/period';
import { BadgesService } from '../badges/badges.service';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badges: BadgesService,
  ) {}

  /** The new category plus the badge tiers creating it earned. */
  async create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.category.count({ where: { userId } });

      const category = await tx.category.create({
        data: {
          ...dto,
          userId,
          order: count,
        },
      });

      const badgesEarned = await this.badges.onCategoryCreated(
        tx,
        userId,
        new Date(),
      );
      return { ...category, badgesEarned };
    });
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }

    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });

    // When the category's tasks reset next (null for non-cyclic categories).
    const now = new Date();
    return categories.map((category) => ({
      ...category,
      periodEndsAt: category.cycleType
        ? getPeriodEnd(category.cycleType, now, user.timezone)
        : null,
    }));
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

  async reorder(userId: string, items: ReorderItemDto[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const category = await tx.category.findFirst({
          where: { id: item.id, userId },
        });
        if (!category) continue;

        await tx.category.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });
  }

  async remove(userId: string, id: string) {
    const category = await this.findOne(userId, id);

    if (!category.isDeletable) {
      throw new ForbiddenException('Tej kategorii nie można usunąć');
    }

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
