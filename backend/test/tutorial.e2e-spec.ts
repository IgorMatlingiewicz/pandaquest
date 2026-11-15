import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { TutorialStatus } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { account, bearerFor, createApp } from './app';
import { createUser, deleteAccount, resetDatabase } from './db';

/*
 * The tutorial status over HTTP on a real Postgres: where the app reads it
 * (GET /auth/me), and the moves, which never go back.
 */
describe('tutorial', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());

  type Person = { id: string; auth: { Authorization: string } };
  async function person(status?: TutorialStatus): Promise<Person> {
    const user = await createUser(prisma);
    if (status) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tutorialStatus: status },
      });
    }
    return { id: user.id, auth: bearerFor(app, user) };
  }

  const statusOf = async (who: Person) =>
    (
      await prisma.user.findUniqueOrThrow({
        where: { id: who.id },
        select: { tutorialStatus: true },
      })
    ).tutorialStatus;

  const dismiss = (who: Person) =>
    api().post('/tutorial/dismiss').set(who.auth);
  const complete = (who: Person) =>
    api().post('/tutorial/complete').set(who.auth);

  const BRIGHT_START = { key: 'bright_start', tier: 'BRONZE', xp: 10 };

  /** What the database holds of the reward: badges, XP events, XP, level. */
  async function rewardOf(who: Person) {
    const [badges, xpEvents, user] = await Promise.all([
      prisma.userBadge.findMany({ where: { userId: who.id } }),
      prisma.xpEvent.findMany({ where: { userId: who.id } }),
      prisma.user.findUniqueOrThrow({
        where: { id: who.id },
        select: { xpTotal: true, level: true },
      }),
    ]);
    return { badges, xpEvents, ...user };
  }

  it('answers 401 without a token on every route', async () => {
    await api().post('/tutorial/dismiss').expect(401);
    await api().post('/tutorial/complete').expect(401);
  });

  describe('GET /auth/me', () => {
    it('gives a new account NOT_STARTED, signed up as the app does', async () => {
      const me = await account(app, 'new@example.com');

      const body = (await api().get('/auth/me').set(me.auth).expect(200))
        .body as unknown;

      expect(body).toMatchObject({ tutorialStatus: 'NOT_STARTED' });
    });

    it('shows the stored status', async () => {
      const me = await person('DISMISSED');

      const body = (await api().get('/auth/me').set(me.auth).expect(200))
        .body as unknown;

      expect(body).toMatchObject({ tutorialStatus: 'DISMISSED' });
    });
  });

  describe('POST /tutorial/dismiss', () => {
    it('moves NOT_STARTED to DISMISSED, answered with 200', async () => {
      const me = await person();

      const body = (await dismiss(me).expect(200)).body as unknown;

      expect(body).toEqual({ tutorialStatus: 'DISMISSED' });
      expect(await statusOf(me)).toBe('DISMISSED');
    });

    it('can be sent again: the same answer, no error', async () => {
      const me = await person();
      await dismiss(me).expect(200);

      const body = (await dismiss(me).expect(200)).body as unknown;

      expect(body).toEqual({ tutorialStatus: 'DISMISSED' });
    });

    it('never moves a finished tutorial back, and says it is finished', async () => {
      const me = await person('COMPLETED');

      const body = (await dismiss(me).expect(200)).body as unknown;

      expect(body).toEqual({ tutorialStatus: 'COMPLETED' });
      expect(await statusOf(me)).toBe('COMPLETED');
    });

    it('changes only the caller', async () => {
      const [me, other] = [await person(), await person()];

      await dismiss(me).expect(200);

      expect(await statusOf(other)).toBe('NOT_STARTED');
    });

    it('answers 401 when the account behind the token is gone', async () => {
      const me = await account(app, 'gone@example.com');
      await deleteAccount(prisma, me.id);

      await api().post('/tutorial/dismiss').set(me.auth).expect(401);
      await api().post('/tutorial/complete').set(me.auth).expect(401);
    });
  });

  describe('POST /tutorial/complete', () => {
    it('finishes the tutorial and earns Bright Start: badge, 10 XP event, XP', async () => {
      const me = await person();

      const body = (await complete(me).expect(200)).body as unknown;

      expect(body).toEqual({
        tutorialStatus: 'COMPLETED',
        badgesEarned: [BRIGHT_START],
      });
      const reward = await rewardOf(me);
      expect(reward.badges).toEqual([
        expect.objectContaining({ badgeKey: 'bright_start', tier: 'BRONZE' }),
      ]);
      expect(reward.xpEvents).toEqual([
        expect.objectContaining({
          source: 'BADGE',
          baseXp: 10,
          multiplier: 1,
          amount: 10,
          taskId: null,
        }),
      ]);
      expect(reward.xpTotal).toBe(10);
      expect(await statusOf(me)).toBe('COMPLETED');
    });

    it('twice: one badge, one XP event, XP and level counted once', async () => {
      // 95 XP: the 10 of the badge cross into level 2, once.
      const me = await person();
      await prisma.user.update({
        where: { id: me.id },
        data: { xpTotal: 95 },
      });

      await complete(me).expect(200);
      const second = (await complete(me).expect(200)).body as unknown;

      expect(second).toEqual({ tutorialStatus: 'COMPLETED', badgesEarned: [] });
      const reward = await rewardOf(me);
      expect(reward.badges).toHaveLength(1);
      expect(reward.xpEvents).toHaveLength(1);
      expect(reward).toMatchObject({ xpTotal: 105, level: 2 });
    });

    it('after a skip: still finishes, and still earns the badge', async () => {
      const me = await person();
      await dismiss(me).expect(200);

      const body = (await complete(me).expect(200)).body as unknown;

      expect(body).toEqual({
        tutorialStatus: 'COMPLETED',
        badgesEarned: [BRIGHT_START],
      });
    });

    it('a skip after it changes nothing and earns nothing', async () => {
      const me = await person();
      await complete(me).expect(200);

      const body = (await dismiss(me).expect(200)).body as unknown;

      expect(body).toEqual({ tutorialStatus: 'COMPLETED' });
      expect((await rewardOf(me)).xpEvents).toHaveLength(1);
    });

    it('rewards only the caller', async () => {
      const [me, other] = [await person(), await person()];

      await complete(me).expect(200);

      expect(await statusOf(other)).toBe('NOT_STARTED');
      expect((await rewardOf(other)).badges).toEqual([]);
    });

    describe('two at the same moment: one badge', () => {
      const rounds = 10;

      // Each round: two requests at once, then what the database holds.
      async function race(start: () => Promise<Person>) {
        for (let round = 0; round < rounds; round++) {
          const me = await start();

          const responses = await Promise.all([complete(me), complete(me)]);

          expect(responses.map((r) => r.status)).toEqual([200, 200]);
          const earned = responses.map(
            (r) => (r.body as { badgesEarned: unknown[] }).badgesEarned.length,
          );
          expect(earned.sort()).toEqual([0, 1]);
          const reward = await rewardOf(me);
          expect(reward.badges).toHaveLength(1);
          expect(reward.xpEvents).toHaveLength(1);
          expect(reward.xpTotal).toBe(10);
        }
      }

      it('from NOT_STARTED: the status write queues them on the user row', async () => {
        await race(() => person());
      });

      it('with the status already COMPLETED but no badge: the unique key decides', async () => {
        // No status write happens, so nothing queues the two requests: both
        // try to insert the badge, and only user_badges' unique key stops
        // the second (ON CONFLICT DO NOTHING, no XP for it).
        await race(() => person('COMPLETED'));
      });
    });
  });

  describe('the badge count, now 27', () => {
    it('shows on the own profile and on a friend’s profile', async () => {
      const [me, friend] = [await person(), await person()];
      const friendship = await prisma.friendship.create({
        data: {
          requesterId: me.id,
          addresseeId: friend.id,
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });
      await complete(friend).expect(200);

      const own = (await api().get('/profile').set(friend.auth).expect(200))
        .body as { badges: unknown };
      const seen = (
        await api()
          .get(`/friends/${friendship.id}/profile`)
          .set(me.auth)
          .expect(200)
      ).body as { badges: unknown };

      expect(own.badges).toEqual({ earned: 1, total: 27 });
      expect(seen.badges).toEqual({ earned: 1, total: 27 });
    });

    it('lists Bright Start among the achievements, earned once finished', async () => {
      const me = await person();
      const find = async () =>
        (
          (await api().get('/achievements').set(me.auth).expect(200)).body as {
            key: string;
            current: number;
            tiers: unknown[];
          }[]
        ).find((a) => a.key === 'bright_start');

      expect(await find()).toMatchObject({ current: 0 });
      await complete(me).expect(200);
      expect(await find()).toMatchObject({
        current: 1,
        tiers: [
          {
            tier: 'BRONZE',
            threshold: 1,
            xp: 10,
            earnedAt: expect.any(String) as string,
          },
        ],
      });
    });
  });
});
