import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

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

type AuthedRequest = Parameters<StatsController['getStats']>[0];

describe('StatsController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const service = { getStats: jest.fn() };
  let controller: StatsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: service }],
    }).compile();

    controller = module.get(StatsController);
  });

  it('reads the statistics of the authenticated user only', async () => {
    await controller.getStats(req);

    expect(service.getStats).toHaveBeenCalledWith(USER_ID);
  });
});
