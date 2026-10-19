import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsController } from './achievements.controller';
import { BadgesService } from './badges.service';

// @nestjs/passport ships ESM only, which Jest cannot load here, so the guard
// is replaced; authentication itself is not what these tests cover.
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

type AuthedRequest = Parameters<AchievementsController['findAll']>[0];

describe('AchievementsController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const badgesService = { getAchievements: jest.fn() };
  let controller: AchievementsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AchievementsController],
      providers: [{ provide: BadgesService, useValue: badgesService }],
    }).compile();

    controller = module.get(AchievementsController);
  });

  it('returns the achievements of the user from the token', async () => {
    const achievements = [{ key: 'first_day', current: 1, tiers: [] }];
    badgesService.getAchievements.mockResolvedValue(achievements);

    await expect(controller.findAll(req)).resolves.toBe(achievements);
    expect(badgesService.getAchievements).toHaveBeenCalledWith(USER_ID);
  });
});
