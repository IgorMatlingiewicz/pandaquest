import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendRequestsService } from './friend-requests.service';
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

const httpCodeOf = (method: keyof FriendsController) =>
  Reflect.getMetadata(
    HTTP_CODE_METADATA,
    Object.getOwnPropertyDescriptor(FriendsController.prototype, method)
      ?.value as object,
  ) as number | undefined;

describe('FriendsController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const friends = {
    getCode: jest.fn(),
    regenerateCode: jest.fn(),
    list: jest.fn(),
    profile: jest.fn(),
    badges: jest.fn(),
    remove: jest.fn(),
  };
  const requests = {
    send: jest.fn(),
    list: jest.fn(),
    accept: jest.fn(),
    decline: jest.fn(),
    cancel: jest.fn(),
    summary: jest.fn(),
  };
  let controller: FriendsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        { provide: FriendsService, useValue: friends },
        { provide: FriendRequestsService, useValue: requests },
      ],
    }).compile();

    controller = module.get(FriendsController);
  });

  it('reads the code of the authenticated user only', async () => {
    friends.getCode.mockResolvedValue({ code: 'ABCDEFGH' });

    await expect(controller.getCode(req)).resolves.toEqual({
      code: 'ABCDEFGH',
    });
    expect(friends.getCode).toHaveBeenCalledWith(USER_ID);
  });

  it('draws a new code for the authenticated user only', async () => {
    await controller.regenerateCode(req);

    expect(friends.regenerateCode).toHaveBeenCalledWith(USER_ID);
  });

  it('sends a request from the authenticated user with the code typed', async () => {
    await controller.sendRequest(req, { code: 'abcd-efgh' });

    expect(requests.send).toHaveBeenCalledWith(USER_ID, 'abcd-efgh');
  });

  it.each([
    ['listRequests', 'list'],
    ['summary', 'summary'],
  ] as const)(
    '%s reads for the authenticated user only',
    async (route, method) => {
      await controller[route](req);

      expect(requests[method]).toHaveBeenCalledWith(USER_ID);
    },
  );

  it.each([
    ['acceptRequest', 'accept'],
    ['declineRequest', 'decline'],
    ['cancelRequest', 'cancel'],
  ] as const)(
    '%s acts on the request in the path as the authenticated user',
    async (route, method) => {
      await controller[route](req, 'request-9');

      expect(requests[method]).toHaveBeenCalledWith(USER_ID, 'request-9');
    },
  );

  it('lists the friends of the authenticated user only', async () => {
    await controller.listFriends(req);

    expect(friends.list).toHaveBeenCalledWith(USER_ID);
  });

  it.each([
    ['friendProfile', 'profile'],
    ['friendBadges', 'badges'],
    ['removeFriend', 'remove'],
  ] as const)(
    '%s acts on the friendship in the path as the authenticated user',
    async (route, method) => {
      await controller[route](req, 'friendship-7');

      expect(friends[method]).toHaveBeenCalledWith(USER_ID, 'friendship-7');
    },
  );

  it.each([
    ['regenerateCode', 200],
    ['acceptRequest', 200],
    ['declineRequest', 200],
    ['cancelRequest', 204],
    ['removeFriend', 204],
    ['sendRequest', undefined],
  ] as const)('%s answers with %s', (route, status) => {
    expect(httpCodeOf(route)).toBe(status);
  });
});
