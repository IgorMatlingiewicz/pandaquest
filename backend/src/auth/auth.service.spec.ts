import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { FRIEND_CODE_INDEX, isFriendCode } from '../friends/friend-code';
import { uniqueViolation } from '../testing/prisma-errors';
import type { PrismaService } from '../prisma/prisma.service';
import { TaskType } from '../generated/prisma/client';

// @nestjs/jwt ships ESM only, which Jest cannot load here. The service just
// needs the class as an injection token.
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type CreatedTask = {
  data: {
    title: string;
    type: TaskType;
    progressCurrent?: number;
    completions?: { create: { periodKey: string; progressCurrent: number } };
  };
};

describe('AuthService', () => {
  const PASSWORD = 'haslo12345';

  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    category: { create: jest.fn() },
    task: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
    );
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      username: 'newbie',
      password: PASSWORD,
    };

    const createdTask = (title: string) =>
      (prisma.task.create.mock.calls as [CreatedTask][])
        .map(([args]) => args.data)
        .find((data) => data.title === title);

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        ({ data }: { data: { timezone?: string } }) =>
          Promise.resolve({
            id: 'user-1',
            ...data,
            timezone: data.timezone ?? 'Europe/Warsaw',
          }),
      );
      prisma.category.create.mockImplementation(
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: `category-${data.name}` }),
      );
    });

    it('rejects an email that is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('stores a hashed password and never returns it', async () => {
      const result = await service.register(dto);

      const { data } = (
        prisma.user.create.mock.calls as [{ data: { passwordHash: string } }][]
      )[0][0];
      expect(data.passwordHash).not.toBe(PASSWORD);
      expect(await argon2.verify(data.passwordHash, PASSWORD)).toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('seeds the three default cycle categories', async () => {
      await service.register(dto);

      const cycleTypes = (
        prisma.category.create.mock.calls as [
          { data: { cycleType: TaskType; isDeletable: boolean } },
        ][]
      ).map(([args]) => args.data);
      expect(cycleTypes).toEqual([
        expect.objectContaining({
          cycleType: TaskType.DAILY,
          isDeletable: false,
        }),
        expect.objectContaining({
          cycleType: TaskType.WEEKLY,
          isDeletable: false,
        }),
        expect.objectContaining({
          cycleType: TaskType.LIFE,
          isDeletable: false,
        }),
      ]);
    });

    it("seeds cyclic progress as completions for the new user's current period", async () => {
      // Monday 18:00 in Warsaw, already Tuesday 06:00 on Kiritimati (UTC+14).
      jest.useFakeTimers({ now: new Date('2026-10-05T16:00:00Z') });

      await service.register({ ...dto, timezone: 'Pacific/Kiritimati' });

      const { data: createdUser } = (
        prisma.user.create.mock.calls as [{ data: { timezone?: string } }][]
      )[0][0];
      expect(createdUser.timezone).toBe('Pacific/Kiritimati');

      const dog = createdTask('Wyprowadź psa');
      expect(dog?.completions).toEqual({
        create: { periodKey: '2026-10-06', progressCurrent: 1 },
      });
      expect(dog?.progressCurrent).toBeUndefined();

      const gym = createdTask('Idź na siłownię');
      expect(gym?.completions).toEqual({
        create: { periodKey: '2026-W41', progressCurrent: 2 },
      });
      expect(gym?.progressCurrent).toBeUndefined();
    });

    it('gives the new user a friend code', async () => {
      await service.register(dto);

      const { data } = (
        prisma.user.create.mock.calls as [{ data: { friendCode: string } }][]
      )[0][0];
      expect(isFriendCode(data.friendCode)).toBe(true);
    });

    it('redoes the whole sign-up with a new code when the code is taken', async () => {
      prisma.user.create.mockRejectedValueOnce(
        uniqueViolation(FRIEND_CODE_INDEX),
      );

      await service.register(dto);

      const codes = (
        prisma.user.create.mock.calls as [{ data: { friendCode: string } }][]
      ).map(([args]) => args.data.friendCode);
      expect(codes).toHaveLength(2);
      expect(codes[1]).not.toBe(codes[0]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('answers 409 when another sign-up takes the email at the same moment', async () => {
      prisma.user.create.mockRejectedValueOnce(
        uniqueViolation('users_email_key'),
      );

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('keeps LIFE progress on the task itself', async () => {
      await service.register(dto);

      const savings = createdTask('Oszczędź 100 000 PLN');
      expect(savings?.progressCurrent).toBe(27000);
      expect(savings?.completions).toBeUndefined();
    });
  });

  describe('login', () => {
    let user: {
      id: string;
      email: string;
      passwordHash: string;
      timezone: string;
    };

    beforeAll(async () => {
      user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: await argon2.hash(PASSWORD),
        timezone: 'Europe/Warsaw',
      };
    });

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(user);
      jwt.signAsync.mockResolvedValue('signed-token');
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('returns a token signed for the user', async () => {
      const result = await service.login({
        email: user.email,
        password: PASSWORD,
      });

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });

    it('updates the stored timezone when the device reports a new one', async () => {
      await service.login({
        email: user.email,
        password: PASSWORD,
        timezone: 'America/New_York',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { timezone: 'America/New_York' },
      });
    });

    it('does not touch the user when the timezone is unchanged or missing', async () => {
      await service.login({
        email: user.email,
        password: PASSWORD,
        timezone: 'Europe/Warsaw',
      });
      await service.login({ email: user.email, password: PASSWORD });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('does not update the timezone when the password is wrong', async () => {
      await expect(
        service.login({
          email: user.email,
          password: 'wrong-password',
          timezone: 'America/New_York',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('returns the public fields plus level progress derived from xpTotal', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user',
        passwordHash: 'secret-hash',
        timezone: 'Europe/Warsaw',
        xpTotal: 250,
        level: 3,
      });

      expect(await service.getProfile('user-1')).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user',
        xpTotal: 250,
        level: 3,
        levelProgress: {
          level: 3,
          xpIntoLevel: 50,
          xpForNextLevel: 110,
          isMax: false,
        },
      });
    });

    it('rejects an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('ghost')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const NEW_PASSWORD = 'nowehaslo123';
    let user: { id: string; email: string; passwordHash: string };

    beforeEach(async () => {
      user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: await argon2.hash(PASSWORD),
      };
      // One stored user that the update really changes, so a later login
      // sees the new hash.
      prisma.user.findUnique.mockImplementation(() =>
        Promise.resolve({ ...user, timezone: 'Europe/Warsaw' }),
      );
      prisma.user.update.mockImplementation(
        ({ data }: { data: { passwordHash: string } }) => {
          user.passwordHash = data.passwordHash;
          return Promise.resolve(user);
        },
      );
      jwt.signAsync.mockResolvedValue('signed-token');
    });

    const change = (currentPassword: string, newPassword: string) =>
      service.changePassword(user.id, { currentPassword, newPassword });

    it('stores a hash of the new password for this user, and only theirs', async () => {
      await change(PASSWORD, NEW_PASSWORD);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: user.id } }),
      );
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { passwordHash: expect.any(String) as string },
      });
      expect(user.passwordHash).not.toBe(NEW_PASSWORD);
      expect(await argon2.verify(user.passwordHash, NEW_PASSWORD)).toBe(true);
    });

    it('lets the user log in with the new password and not the old one', async () => {
      await change(PASSWORD, NEW_PASSWORD);

      await expect(
        service.login({ email: user.email, password: NEW_PASSWORD }),
      ).resolves.toEqual({ accessToken: 'signed-token' });
      await expect(
        service.login({ email: user.email, password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a wrong current password with 403 and changes nothing', async () => {
      const before = user.passwordHash;

      await expect(change('wrong-password', NEW_PASSWORD)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(user.passwordHash).toBe(before);
    });

    it('refuses a new password equal to the current one with 409', async () => {
      await expect(change(PASSWORD, PASSWORD)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('checks the current password first, so a wrong one is never a 409', async () => {
      await expect(change('wrong-password', 'wrong-password')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('treats a user that no longer exists as an ended session', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(change(PASSWORD, NEW_PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
