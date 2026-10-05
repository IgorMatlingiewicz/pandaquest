import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskStatus } from '../generated/prisma/client';

// @nestjs/passport and @nestjs/mapped-types ship ESM only, which Jest cannot
// load here. The guard is replaced, and PartialType (used by the update DTO)
// gets a stand-in; DTO validation is not what these tests cover.
jest.mock('@nestjs/mapped-types', () => ({
  PartialType: <T extends new () => object>(base: T) => base,
}));
jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type AuthedRequest = Parameters<TaskController['findAll']>[0];

describe('TaskController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const taskService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  };
  let controller: TaskController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: taskService }],
    }).compile();

    controller = module.get<TaskController>(TaskController);
  });

  it('create uses the user id from the token, not from the body', async () => {
    const dto = { title: 'Podlej kwiaty', categoryId: 'category-1' };

    await controller.create(req, dto);

    expect(taskService.create).toHaveBeenCalledWith(USER_ID, dto);
  });

  it('findAll scopes the list to the authenticated user and category', async () => {
    taskService.findAll.mockResolvedValue([{ id: 'task-1' }]);

    await expect(controller.findAll(req, 'category-1')).resolves.toEqual([
      { id: 'task-1' },
    ]);
    expect(taskService.findAll).toHaveBeenCalledWith(USER_ID, 'category-1');
  });

  it('findOne scopes the lookup to the authenticated user', async () => {
    await controller.findOne(req, 'task-1');

    expect(taskService.findOne).toHaveBeenCalledWith(USER_ID, 'task-1');
  });

  it('update scopes the change to the authenticated user', async () => {
    const dto = { status: TaskStatus.COMPLETED };

    await controller.update(req, 'task-1', dto);

    expect(taskService.update).toHaveBeenCalledWith(USER_ID, 'task-1', dto);
  });

  it('remove scopes the delete to the authenticated user', async () => {
    await controller.remove(req, 'task-1');

    expect(taskService.remove).toHaveBeenCalledWith(USER_ID, 'task-1');
  });

  it('reorder passes only the items to the service', async () => {
    const items = [
      { id: 'task-1', order: 1 },
      { id: 'task-2', order: 0 },
    ];

    await controller.reorder(req, { items });

    expect(taskService.reorder).toHaveBeenCalledWith(USER_ID, items);
  });
});
