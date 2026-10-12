import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderItemDto } from '../common/dto/reorder.dto';
import {
  Prisma,
  TaskCompletion,
  TaskStatus,
  TaskType,
} from '../generated/prisma/client';
import { getPeriodKey } from '../common/period';

// Current period key per cyclic task type; other types have no entry.
type PeriodKeys = Partial<Record<TaskType, string>>;

type TaskWithCompletions = {
  type: TaskType;
  completionMode: string;
  status: TaskStatus;
  progressCurrent: number | null;
  completions: TaskCompletion[];
};

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('Kategoria nie znaleziona');
    }

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
        // A cycle category (Daily/Weekly/Life) always dictates the task's
        // type, regardless of what the client sent.
        type: category.cycleType ?? dto.type,
        order: count,
      },
    });
  }

  async findAll(userId: string, categoryId?: string) {
    const keys = await this.getPeriodKeys(userId);
    const completions = this.currentCompletions(keys);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        completions,
        subtasks: { include: { completions }, orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });

    return tasks.map((task) => ({
      ...this.withDerivedState(task, keys),
      subtasks: task.subtasks.map((s) => this.withDerivedState(s, keys)),
    }));
  }

  async findOne(userId: string, id: string) {
    const keys = await this.getPeriodKeys(userId);
    return this.findOneForPeriod(userId, id, keys);
  }

  private async findOneForPeriod(userId: string, id: string, keys: PeriodKeys) {
    const completions = this.currentCompletions(keys);

    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { completions, subtasks: { include: { completions } } },
    });

    if (!task) {
      throw new NotFoundException('Zadanie nie znalezione');
    }

    return {
      ...this.withDerivedState(task, keys),
      subtasks: task.subtasks.map((s) => this.withDerivedState(s, keys)),
    };
  }

  private async getPeriodKeys(userId: string): Promise<PeriodKeys> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }

    const now = new Date();
    const keys: PeriodKeys = {};
    for (const type of Object.values(TaskType)) {
      const key = getPeriodKey(type, now, user.timezone);
      if (key) keys[type] = key;
    }
    return keys;
  }

  private currentCompletions(keys: PeriodKeys) {
    return { where: { periodKey: { in: Object.values(keys) } } };
  }

  private withDerivedState<T extends TaskWithCompletions>(
    task: T,
    keys: PeriodKeys,
  ): Omit<T, 'completions'> {
    const { completions, ...rest } = task;

    const periodKey = keys[task.type];
    if (!periodKey) return rest;

    const completion = completions.find((c) => c.periodKey === periodKey);
    return {
      ...rest,
      status: completion?.completedAt
        ? TaskStatus.COMPLETED
        : TaskStatus.ACTIVE,
      progressCurrent:
        completion?.progressCurrent ??
        (task.completionMode === 'PROGRESS' ? 0 : null),
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.task.delete({ where: { id } });
  }

  async reorder(userId: string, items: ReorderItemDto[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const task = await tx.task.findFirst({
          where: { id: item.id, userId },
        });
        if (!task) continue;

        await tx.task.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const keys = await this.getPeriodKeys(userId);
    const task = await this.findOneForPeriod(userId, id, keys);
    this.assertNotMoved(task, dto);
    const changes = this.editableFields(dto);

    const reachedTarget =
      task.completionMode === 'PROGRESS' &&
      changes.progressCurrent !== undefined &&
      task.progressTarget !== null &&
      changes.progressCurrent >= task.progressTarget;

    const periodKey = keys[task.type];
    if (periodKey) {
      return this.updateCyclic(
        userId,
        task,
        periodKey,
        keys,
        changes,
        reachedTarget,
      );
    }

    const data = { ...changes };

    if (reachedTarget) {
      data.status = TaskStatus.COMPLETED;
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data,
    });

    if (data.status && task.parentTaskId) {
      await this.syncParentStatus(userId, task.parentTaskId, keys);
    }

    return updated;
  }

  /** A task keeps the category, and so the type, it was created with. */
  private assertNotMoved(
    task: { categoryId: string; type: TaskType },
    dto: UpdateTaskDto,
  ) {
    const moved =
      dto.categoryId !== undefined && dto.categoryId !== task.categoryId;
    const retyped = dto.type !== undefined && dto.type !== task.type;

    if (moved || retyped) {
      throw new BadRequestException(
        'Nie można zmienić kategorii ani typu zadania',
      );
    }
  }

  /**
   * The only fields PATCH may write. Anything else in the request body
   * (userId, createdAt, parentTaskId, ...) is dropped here.
   */
  private editableFields(dto: UpdateTaskDto) {
    const {
      title,
      completionMode,
      progressTarget,
      deadline,
      status,
      progressCurrent,
    } = dto;

    return {
      title,
      completionMode,
      progressTarget,
      deadline,
      status,
      progressCurrent,
    };
  }

  private async updateCyclic(
    userId: string,
    task: { id: string; parentTaskId: string | null },
    periodKey: string,
    keys: PeriodKeys,
    changes: ReturnType<TaskService['editableFields']>,
    reachedTarget: boolean,
  ) {
    const { status, progressCurrent, ...template } = changes;

    const completed = reachedTarget
      ? true
      : status === undefined
        ? undefined
        : status === TaskStatus.COMPLETED;

    await this.prisma.$transaction(async (tx) => {
      if (Object.values(template).some((v) => v !== undefined)) {
        await tx.task.update({ where: { id: task.id }, data: template });
      }
      if (completed !== undefined || progressCurrent !== undefined) {
        await this.saveCompletion(tx, task.id, periodKey, {
          completed,
          progressCurrent,
        });
      }
    });

    if (completed !== undefined && task.parentTaskId) {
      await this.syncParentStatus(userId, task.parentTaskId, keys);
    }

    // Same shape as the non-cyclic branch: the task itself, no subtasks.
    const updated = await this.prisma.task.findFirstOrThrow({
      where: { id: task.id, userId },
      include: { completions: this.currentCompletions(keys) },
    });
    return this.withDerivedState(updated, keys);
  }

  private async saveCompletion(
    tx: Prisma.TransactionClient,
    taskId: string,
    periodKey: string,
    change: { completed?: boolean; progressCurrent?: number },
  ) {
    const now = new Date();
    const { completed, progressCurrent } = change;

    await tx.taskCompletion.upsert({
      where: { taskId_periodKey: { taskId, periodKey } },
      create: {
        taskId,
        periodKey,
        progressCurrent,
        completedAt: completed ? now : null,
        firstCompletedAt: completed ? now : null,
      },
      update: {
        progressCurrent,
        ...(completed === false ? { completedAt: null } : {}),
      },
    });

    if (completed) {
      await tx.taskCompletion.updateMany({
        where: { taskId, periodKey, completedAt: null },
        data: { completedAt: now },
      });
      await tx.taskCompletion.updateMany({
        where: { taskId, periodKey, firstCompletedAt: null },
        data: { firstCompletedAt: now },
      });
    }
  }

  private async syncParentStatus(
    userId: string,
    parentId: string,
    keys: PeriodKeys,
  ) {
    const completions = this.currentCompletions(keys);

    const parent = await this.prisma.task.findFirst({
      where: { id: parentId, userId },
      include: {
        completions,
        subtasks: { where: { userId }, include: { completions } },
      },
    });
    if (!parent) return;

    const allCompleted = parent.subtasks.every(
      (t) => this.withDerivedState(t, keys).status === 'COMPLETED',
    );
    const newStatus = allCompleted ? TaskStatus.COMPLETED : TaskStatus.ACTIVE;

    if (this.withDerivedState(parent, keys).status !== newStatus) {
      const periodKey = keys[parent.type];
      if (periodKey) {
        await this.saveCompletion(this.prisma, parentId, periodKey, {
          completed: allCompleted,
        });
      } else {
        await this.prisma.task.update({
          where: { id: parentId },
          data: { status: newStatus },
        });
      }

      if (parent.parentTaskId) {
        await this.syncParentStatus(userId, parent.parentTaskId, keys);
      }
    }
  }
}
