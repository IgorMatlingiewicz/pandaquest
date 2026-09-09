import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from '../generated/prisma/client';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const count = await this.prisma.task.count({
      where: {
        userId,
        categoryId: dto.categoryId,
        parentTaskId: dto.parentTaskId ?? null,
      },
    });

    return this.prisma.task.create({
      data: {
        ...dto,
        userId,
        order: count,
      },
    });
  }

  async findAll(userId: string, categoryId?: string) {
    return this.prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { subtasks: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { subtasks: true },
    });

    if (!task) {
      throw new NotFoundException('Zadanie nie znalezione');
    }

    return task;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.task.delete({ where: { id } });
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.findOne(userId, id);

    const data = { ...dto };

    if (
      task.completionMode === 'PROGRESS' &&
      dto.progressCurrent !== undefined &&
      task.progressTarget !== null &&
      dto.progressCurrent >= task.progressTarget
    ) {
      data.status = TaskStatus.COMPLETED;
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data,
    });

    if (data.status && task.parentTaskId) {
      await this.syncParentStatus(userId, task.parentTaskId);
    }

    return updated;
  }

  private async syncParentStatus(userId: string, parentId: string) {
    const parent = await this.prisma.task.findFirst({
      where: { id: parentId, userId },
    });
    if (!parent) return;

    const siblings = await this.prisma.task.findMany({
      where: { parentTaskId: parentId },
    });

    const allCompleted = siblings.every((t) => t.status === 'COMPLETED');
    const newStatus = allCompleted ? TaskStatus.COMPLETED : TaskStatus.ACTIVE;

    if (parent.status !== newStatus) {
      await this.prisma.task.update({
        where: { id: parentId },
        data: { status: newStatus },
      });

      if (parent.parentTaskId) {
        await this.syncParentStatus(userId, parent.parentTaskId);
      }
    }
  }
}
