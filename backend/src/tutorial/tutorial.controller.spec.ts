import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TutorialController } from './tutorial.controller';
import { TutorialService } from './tutorial.service';

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

type AuthedRequest = Parameters<TutorialController['dismiss']>[0];

const handlerOf = (method: keyof TutorialController) =>
  Object.getOwnPropertyDescriptor(TutorialController.prototype, method)
    ?.value as object;

describe('TutorialController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;
  const tutorial = { dismiss: jest.fn(), complete: jest.fn() };
  let controller: TutorialController;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TutorialController],
      providers: [{ provide: TutorialService, useValue: tutorial }],
    }).compile();
    controller = module.get(TutorialController);
  });

  it('dismisses for the authenticated user only, with the service answer', async () => {
    tutorial.dismiss.mockResolvedValue({ tutorialStatus: 'DISMISSED' });

    await expect(controller.dismiss(req)).resolves.toEqual({
      tutorialStatus: 'DISMISSED',
    });
    expect(tutorial.dismiss).toHaveBeenCalledWith(USER_ID);
  });

  it('completes for the authenticated user only, with the service answer', async () => {
    const answer = {
      tutorialStatus: 'COMPLETED',
      badgesEarned: [{ key: 'bright_start', tier: 'BRONZE', xp: 10 }],
    };
    tutorial.complete.mockResolvedValue(answer);

    await expect(controller.complete(req)).resolves.toEqual(answer);
    expect(tutorial.complete).toHaveBeenCalledWith(USER_ID);
  });

  it.each(['dismiss', 'complete'] as const)(
    '%s answers 200, as nothing is created',
    (route) => {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handlerOf(route))).toBe(
        200,
      );
    },
  );

  it('checks the token on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TutorialController)).toEqual([
      JwtAuthGuard,
    ]);
  });
});
