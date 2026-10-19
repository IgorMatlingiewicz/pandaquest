import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { BadgesService } from '../badges/badges.service';
import { TaskType } from '../generated/prisma/client';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CategoryService', () => {
  const USER_ID = 'user-1';

  const prisma = {
    user: { findUnique: jest.fn() },
    category: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    task: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const badges = { onCategoryCreated: jest.fn() };
  let service: CategoryService;

  beforeEach(() => {
    jest.resetAllMocks();
    // The callback gets `prisma` itself as the transaction client.
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
    );
    service = new CategoryService(
      prisma as unknown as PrismaService,
      badges as unknown as BadgesService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    const dto = { name: 'Muzyka' };

    beforeEach(() => {
      prisma.category.count.mockResolvedValue(4);
      prisma.category.create.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ id: 'new', ...data }),
      );
      badges.onCategoryCreated.mockResolvedValue([]);
    });

    it('creates the category at the end of the list', async () => {
      await service.create(USER_ID, dto);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { ...dto, userId: USER_ID, order: 4 },
      });
    });

    it('evaluates badges after the insert, in the same transaction', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-05T10:00:00Z') });

      await service.create(USER_ID, dto);

      expect(badges.onCategoryCreated).toHaveBeenCalledWith(
        prisma,
        USER_ID,
        new Date('2026-10-05T10:00:00Z'),
      );
      expect(prisma.category.create.mock.invocationCallOrder[0]).toBeLessThan(
        badges.onCategoryCreated.mock.invocationCallOrder[0],
      );
    });

    it('returns the category plus badgesEarned', async () => {
      const award = { key: 'many_categories', tier: 'SILVER', xp: 150 };
      badges.onCategoryCreated.mockResolvedValue([award]);

      const created = await service.create(USER_ID, dto);

      expect(created).toEqual({
        id: 'new',
        ...dto,
        userId: USER_ID,
        order: 4,
        badgesEarned: [award],
      });
    });
  });

  describe('remove', () => {
    it('refuses to delete a category with isDeletable=false', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'daily',
        userId: USER_ID,
        isDeletable: false,
      });

      await expect(service.remove(USER_ID, 'daily')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it("does not find another user's category", async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove('intruder', 'daily')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'daily', userId: 'intruder' },
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a category that still has tasks', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'custom',
        userId: USER_ID,
        isDeletable: true,
      });
      prisma.task.count.mockResolvedValue(2);

      await expect(service.remove(USER_ID, 'custom')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty, deletable category', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'custom',
        userId: USER_ID,
        isDeletable: true,
      });
      prisma.task.count.mockResolvedValue(0);

      await service.remove(USER_ID, 'custom');

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'custom' },
      });
    });
  });

  describe('findAll', () => {
    it("adds the next reset time in the user's timezone", async () => {
      // Monday 14:00 in Warsaw (UTC+2).
      jest.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z') });
      prisma.user.findUnique.mockResolvedValue({ timezone: 'Europe/Warsaw' });
      prisma.category.findMany.mockResolvedValue([
        { id: 'daily', cycleType: TaskType.DAILY },
        { id: 'weekly', cycleType: TaskType.WEEKLY },
        { id: 'life', cycleType: TaskType.LIFE },
        { id: 'custom', cycleType: null },
      ]);

      const categories = await service.findAll(USER_ID);

      expect(categories).toEqual([
        expect.objectContaining({
          id: 'daily',
          periodEndsAt: new Date('2026-10-05T22:00:00Z'),
        }),
        expect.objectContaining({
          id: 'weekly',
          periodEndsAt: new Date('2026-10-11T22:00:00Z'),
        }),
        expect.objectContaining({ id: 'life', periodEndsAt: null }),
        expect.objectContaining({ id: 'custom', periodEndsAt: null }),
      ]);
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
    });
  });
});
