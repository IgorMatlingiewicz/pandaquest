import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { isFriendCode, withFreshFriendCode } from '../src/friends/friend-code';
import { PrismaService } from '../src/prisma/prisma.service';
import { account, createApp, signUp } from './app';
import { createUser, deleteAccount, resetDatabase } from './db';

/*
 * Friend codes on a real Postgres: given at sign-up, drawn again when the
 * database says a code is taken, read and replaced over HTTP.
 */
describe('friend codes', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());

  describe('at sign-up', () => {
    it('gives every new account its own valid code', async () => {
      for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
        expect((await signUp(app, email)).status).toBe(201);
      }

      const codes = (await prisma.user.findMany()).map((u) => u.friendCode);
      expect(codes).toHaveLength(3);
      expect(codes.every(isFriendCode)).toBe(true);
      expect(new Set(codes).size).toBe(3);
    });

    it('does not show the code in the sign-up answer', async () => {
      const response = await signUp(app, 'a@example.com');

      expect(response.body as object).not.toHaveProperty('friendCode');
    });

    it('still answers 409 for an email already taken', async () => {
      await signUp(app, 'a@example.com');

      expect((await signUp(app, 'a@example.com')).status).toBe(409);
      expect(await prisma.user.count()).toBe(1);
    });

    it('draws again when the code is taken in the real database', async () => {
      const owner = await createUser(prisma);
      const draws = [owner.friendCode, owner.friendCode, 'FREE2345'];

      const created = await withFreshFriendCode(
        (friendCode) => createUser(prisma, { friendCode }),
        () => draws.shift()!,
      );

      expect(created.friendCode).toBe('FREE2345');
      expect(draws).toEqual([]);
      expect(await prisma.user.count()).toBe(2);
    });
  });

  describe('GET /friends/code', () => {
    it('answers 401 without a token', async () => {
      await api().get('/friends/code').expect(401);
    });

    it('gives the user their own code, and nothing else', async () => {
      const me = await account(app, 'me@example.com');
      await account(app, 'other@example.com');

      const response = await api()
        .get('/friends/code')
        .set(me.auth)
        .expect(200);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: me.id },
      });
      expect(response.body).toEqual({ code: stored.friendCode });
    });

    it('answers 401 when the account behind the token is gone', async () => {
      const me = await account(app, 'me@example.com');
      await deleteAccount(prisma, me.id);

      await api().get('/friends/code').set(me.auth).expect(401);
    });
  });

  describe('POST /friends/code/regenerate', () => {
    it('answers 401 without a token', async () => {
      await api().post('/friends/code/regenerate').expect(401);
    });

    it('replaces the code with a new valid one, answered with 200', async () => {
      const me = await account(app, 'me@example.com');
      const before = (await api().get('/friends/code').set(me.auth)).body as {
        code: string;
      };

      const response = await api()
        .post('/friends/code/regenerate')
        .set(me.auth)
        .expect(200);

      const body = response.body as { code: string };
      const { code } = body;
      expect(Object.keys(body)).toEqual(['code']);
      expect(isFriendCode(code)).toBe(true);
      expect(code).not.toBe(before.code);
      expect((await api().get('/friends/code').set(me.auth)).body).toEqual({
        code,
      });
    });

    it('makes the old code lead nowhere at once', async () => {
      const me = await account(app, 'me@example.com');
      const old = (
        await prisma.user.findUniqueOrThrow({ where: { id: me.id } })
      ).friendCode;

      await api().post('/friends/code/regenerate').set(me.auth).expect(200);

      expect(
        await prisma.user.findUnique({ where: { friendCode: old } }),
      ).toBeNull();
    });

    it('leaves friendships as they are', async () => {
      const me = await account(app, 'me@example.com');
      const friend = await account(app, 'friend@example.com');
      await prisma.friendship.create({
        data: {
          requesterId: me.id,
          addresseeId: friend.id,
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });

      await api().post('/friends/code/regenerate').set(me.auth).expect(200);

      expect(await prisma.friendship.findMany()).toEqual([
        expect.objectContaining({
          requesterId: me.id,
          addresseeId: friend.id,
          status: 'ACCEPTED',
        }),
      ]);
    });

    it('changes only the caller’s code', async () => {
      const me = await account(app, 'me@example.com');
      const other = await account(app, 'other@example.com');
      const otherBefore = (await api().get('/friends/code').set(other.auth))
        .body as object;

      await api().post('/friends/code/regenerate').set(me.auth).expect(200);

      expect((await api().get('/friends/code').set(other.auth)).body).toEqual(
        otherBefore,
      );
    });

    it('answers 401 when the account behind the token is gone', async () => {
      const me = await account(app, 'me@example.com');
      await deleteAccount(prisma, me.id);

      await api().post('/friends/code/regenerate').set(me.auth).expect(401);
    });
  });
});
