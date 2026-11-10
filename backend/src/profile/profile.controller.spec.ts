import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

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

type AuthedRequest = Parameters<ProfileController['getProfile']>[0];

describe('ProfileController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const service = { getProfile: jest.fn(), setFavorites: jest.fn() };
  let controller: ProfileController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: service }],
    }).compile();

    controller = module.get(ProfileController);
  });

  it('reads the profile of the authenticated user only', async () => {
    await controller.getProfile(req);

    expect(service.getProfile).toHaveBeenCalledWith(USER_ID);
  });

  it('changes the showcase of the authenticated user only', async () => {
    const dto = { slots: [null, null, null] };

    await controller.setFavorites(req, dto);

    expect(service.setFavorites).toHaveBeenCalledWith(USER_ID, dto);
  });
});
