import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// @nestjs/jwt and @nestjs/passport ship ESM only, which Jest cannot load
// here. The controller is tested against a mocked service and guard.
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
jest.mock('./jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AuthController', () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('register passes the body to the service', async () => {
    const dto = {
      email: 'new@example.com',
      username: 'newbie',
      password: 'haslo12345',
      timezone: 'Europe/Warsaw',
    };
    authService.register.mockResolvedValue({ id: 'user-1' });

    await expect(controller.register(dto)).resolves.toEqual({ id: 'user-1' });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('login passes the body to the service', async () => {
    const dto = { email: 'user@example.com', password: 'haslo12345' };
    authService.login.mockResolvedValue({ accessToken: 'token' });

    await expect(controller.login(dto)).resolves.toEqual({
      accessToken: 'token',
    });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('getMe loads the profile of the authenticated user', async () => {
    type MeRequest = Parameters<AuthController['getMe']>[0];
    const req = {
      user: { userId: 'user-1', email: 'user@example.com' },
    } as MeRequest;
    authService.getProfile.mockResolvedValue({ id: 'user-1' });

    await expect(controller.getMe(req)).resolves.toEqual({ id: 'user-1' });
    expect(authService.getProfile).toHaveBeenCalledWith('user-1');
  });
});
