import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
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
    changePassword: jest.fn(),
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

  it('changePassword changes the password of the authenticated user', async () => {
    type PasswordRequest = Parameters<AuthController['changePassword']>[0];
    const req = {
      user: { userId: 'user-1', email: 'user@example.com' },
    } as PasswordRequest;
    const dto = { currentPassword: 'haslo12345', newPassword: 'nowehaslo123' };
    authService.changePassword.mockResolvedValue(undefined);

    await expect(controller.changePassword(req, dto)).resolves.toBeUndefined();
    expect(authService.changePassword).toHaveBeenCalledWith('user-1', dto);
  });

  it('changePassword answers 204 with no body', () => {
    // @HttpCode keeps its status on the method itself; it is read, not called.
    const handler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'changePassword',
    )?.value as object;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
  });
});
