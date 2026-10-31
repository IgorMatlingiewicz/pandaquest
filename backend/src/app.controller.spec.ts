import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AppController', () => {
  let appController: AppController;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('reports ok when the database answers', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
      });
    });

    it('asks the database, not just the server', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await appController.getHealth();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('answers 503 when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('P1001'));

      await expect(appController.getHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
