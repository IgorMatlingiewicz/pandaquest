import { Test, TestingModule } from '@nestjs/testing';
import { StreakGoalsController } from './streak-goals.controller';
import { StreakGoalsService } from './streak-goals.service';

// @nestjs/passport ships ESM only, which Jest cannot load here.
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

type AuthedRequest = Parameters<StreakGoalsController['findAll']>[0];

describe('StreakGoalsController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    sync: jest.fn(),
    relapse: jest.fn(),
    remove: jest.fn(),
  };
  let controller: StreakGoalsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreakGoalsController],
      providers: [{ provide: StreakGoalsService, useValue: service }],
    }).compile();

    controller = module.get(StreakGoalsController);
  });

  it('findAll reads only the goals of the authenticated user', async () => {
    await controller.findAll(req);

    expect(service.findAll).toHaveBeenCalledWith(USER_ID);
  });

  it('create uses the user id from the token, not from the body', async () => {
    const dto = { name: 'Papierosy' };

    await controller.create(req, dto);

    expect(service.create).toHaveBeenCalledWith(USER_ID, dto);
  });

  it('sync settles only the goals of the authenticated user', async () => {
    await controller.sync(req);

    expect(service.sync).toHaveBeenCalledWith(USER_ID);
  });

  it('relapse scopes the change to the authenticated user', async () => {
    await controller.relapse(req, 'goal-1');

    expect(service.relapse).toHaveBeenCalledWith(USER_ID, 'goal-1');
  });

  it('remove scopes the delete to the authenticated user', async () => {
    await controller.remove(req, 'goal-1');

    expect(service.remove).toHaveBeenCalledWith(USER_ID, 'goal-1');
  });
});
