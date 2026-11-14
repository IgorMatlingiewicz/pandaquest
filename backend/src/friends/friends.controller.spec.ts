import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

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

type AuthedRequest = Parameters<FriendsController['getCode']>[0];

describe('FriendsController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const service = { getCode: jest.fn(), regenerateCode: jest.fn() };
  let controller: FriendsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [{ provide: FriendsService, useValue: service }],
    }).compile();

    controller = module.get(FriendsController);
  });

  it('reads the code of the authenticated user only', async () => {
    service.getCode.mockResolvedValue({ code: 'ABCDEFGH' });

    await expect(controller.getCode(req)).resolves.toEqual({
      code: 'ABCDEFGH',
    });
    expect(service.getCode).toHaveBeenCalledWith(USER_ID);
  });

  it('draws a new code for the authenticated user only', async () => {
    await controller.regenerateCode(req);

    expect(service.regenerateCode).toHaveBeenCalledWith(USER_ID);
  });

  it('answers a new code with 200, not 201', () => {
    const handler = Object.getOwnPropertyDescriptor(
      FriendsController.prototype,
      'regenerateCode',
    )?.value as object;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
  });
});
