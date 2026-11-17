import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

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

type AuthedRequest = Parameters<RemindersController['getReminders']>[0];

describe('RemindersController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const service = { getReminders: jest.fn(), ack: jest.fn() };
  let controller: RemindersController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [{ provide: RemindersService, useValue: service }],
    }).compile();

    controller = module.get(RemindersController);
  });

  it('reads the reminders of the authenticated user only', async () => {
    await controller.getReminders(req);

    expect(service.getReminders).toHaveBeenCalledWith(USER_ID);
  });

  it('confirms the keys for the authenticated user only', async () => {
    const keys = ['daily:2026-11-17'];

    await controller.ack(req, { keys });

    expect(service.ack).toHaveBeenCalledWith(USER_ID, keys);
  });

  it('answers the confirmation with 204, nothing to send back', () => {
    // @HttpCode keeps its status on the method itself; it is read, not called.
    const handler = Object.getOwnPropertyDescriptor(
      RemindersController.prototype,
      'ack',
    )?.value as object;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
  });
});
