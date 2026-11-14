import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  BadgeTier,
  FriendshipStatus,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { account, bearerFor, createApp } from './app';
import { createUser, resetDatabase } from './db';

/*
 * Friends over HTTP on a real Postgres: the list, a friend's profile and
 * badges, ending a friendship, and that nobody but the two friends can
 * reach any of it (OWASP API1, BOLA: 404 for everyone else).
 */
describe('friends', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());

  type Person = { id: string; auth: { Authorization: string } };
  async function person(username = 'panda', level = 1): Promise<Person> {
    const user = await createUser(prisma, { username });
    await prisma.user.update({ where: { id: user.id }, data: { level } });
    return { id: user.id, auth: bearerFor(app, user) };
  }

  async function pair(
    a: Person,
    b: Person,
    status: FriendshipStatus = 'ACCEPTED',
  ): Promise<string> {
    const row = await prisma.friendship.create({
      data: {
        requesterId: a.id,
        addresseeId: b.id,
        status,
        respondedAt: status === 'PENDING' ? null : new Date(),
      },
    });
    return row.id;
  }

  const earn = (who: Person, badgeKey: string, tier: BadgeTier, day: number) =>
    prisma.userBadge.create({
      data: {
        userId: who.id,
        badgeKey,
        tier,
        earnedAt: new Date(Date.UTC(2026, 9, day, 8)),
      },
    });

  const get = (who: Person, path: string) => api().get(path).set(who.auth);

  it('answers 401 without a token on every route', async () => {
    const id = '00000000-0000-0000-0000-000000000000';
    await api().get('/friends').expect(401);
    await api().get(`/friends/${id}/profile`).expect(401);
    await api().get(`/friends/${id}/badges`).expect(401);
    await api().delete(`/friends/${id}`).expect(401);
  });

  describe('GET /friends', () => {
    it('lists friends by name, whoever asked, with name and level only', async () => {
      const me = await person('me');
      const zenon = await person('Zenon', 2);
      const ala = await person('ala', 9);
      const lukasz = await person('Łukasz', 4);
      const lena = await person('Lena', 3);
      const ids = {
        zenon: await pair(me, zenon),
        ala: await pair(ala, me),
        lukasz: await pair(me, lukasz),
        lena: await pair(lena, me),
      };

      const body = (await get(me, '/friends').expect(200)).body as unknown;

      // Polish order: "Łukasz" comes after "Lena", case does not matter.
      expect(body).toEqual([
        { friendshipId: ids.ala, username: 'ala', level: 9 },
        { friendshipId: ids.lena, username: 'Lena', level: 3 },
        { friendshipId: ids.lukasz, username: 'Łukasz', level: 4 },
        { friendshipId: ids.zenon, username: 'Zenon', level: 2 },
      ]);
    });

    it('leaves out requests that wait or were declined', async () => {
      const me = await person();
      await pair(me, await person(), 'PENDING');
      await pair(await person(), me, 'PENDING');
      await pair(me, await person(), 'DECLINED');

      expect((await get(me, '/friends').expect(200)).body).toEqual([]);
    });

    it('shows each side only their own friends', async () => {
      const [ala, bob, eve] = [
        await person('ala'),
        await person('bob'),
        await person('eve'),
      ];
      await pair(ala, bob);

      expect((await get(eve, '/friends')).body).toEqual([]);
      expect(
        ((await get(bob, '/friends')).body as { username: string }[]).map(
          (f) => f.username,
        ),
      ).toEqual(['ala']);
    });
  });

  describe("a friend's profile and badges", () => {
    it('shows exactly what friends may see, the same as the friend sees', async () => {
      const me = await person('me');
      // Signed up over HTTP: the friend has default tasks, private ones.
      const friend = await account(app, 'friend@example.com', 'Kasia');
      await prisma.user.update({
        where: { id: friend.id },
        data: { level: 6, xpTotal: 1234 },
      });
      const friendship = await pair(me, friend);
      await earn(friend, 'first_day', 'BRONZE', 1);
      await earn(friend, 'daily_streak', 'BRONZE', 3);
      await earn(friend, 'daily_streak', 'SILVER', 20);
      await api()
        .put('/profile/favorite-badges')
        .set(friend.auth)
        .send({
          slots: [null, { badgeKey: 'daily_streak', tier: 'SILVER' }, null],
        })
        .expect(200);

      const body = (await get(me, `/friends/${friendship}/profile`).expect(200))
        .body as unknown;
      const own = (await get(friend, '/profile').expect(200)).body as Record<
        string,
        unknown
      >;

      expect(Object.keys(body as object).sort()).toEqual(
        ['badges', 'favorites', 'joinedAt', 'level', 'username'].sort(),
      );
      expect(body).toEqual({
        username: 'Kasia',
        level: 6,
        joinedAt: own.joinedAt,
        badges: own.badges,
        favorites: own.favorites,
      });
      expect(body).toMatchObject({
        badges: { earned: 3 },
        favorites: [
          null,
          {
            badgeKey: 'daily_streak',
            tier: 'SILVER',
            earnedAt: expect.any(String) as string,
          },
          null,
        ],
      });
    });

    it('lists the badges the friend earned, without progress', async () => {
      const me = await person();
      const friend = await person();
      const friendship = await pair(friend, me);
      await earn(friend, 'daily_streak', 'SILVER', 20);
      await earn(friend, 'daily_streak', 'BRONZE', 3);
      await earn(friend, 'life_goal', 'DIAMOND', 9);

      const body = (await get(me, `/friends/${friendship}/badges`).expect(200))
        .body as unknown;

      expect(body).toEqual([
        {
          key: 'daily_streak',
          tiers: [
            {
              tier: 'BRONZE',
              threshold: 10,
              earnedAt: '2026-10-03T08:00:00.000Z',
            },
            {
              tier: 'SILVER',
              threshold: 30,
              earnedAt: '2026-10-20T08:00:00.000Z',
            },
          ],
        },
        {
          key: 'life_goal',
          tiers: [
            {
              tier: 'DIAMOND',
              threshold: 1,
              earnedAt: '2026-10-09T08:00:00.000Z',
            },
          ],
        },
      ]);
    });

    it('never shows tasks, XP, email, the friend code or ids', async () => {
      const me = await person();
      const friend = await account(app, 'kasia@example.com', 'Kasia');
      const stored = await prisma.user.update({
        where: { id: friend.id },
        data: { xpTotal: 98765 },
      });
      const friendship = await pair(me, friend);
      await earn(friend, 'first_day', 'BRONZE', 1);

      const raw = JSON.stringify([
        (await get(me, '/friends')).body,
        (await get(me, `/friends/${friendship}/profile`)).body,
        (await get(me, `/friends/${friendship}/badges`)).body,
      ]);

      for (const secret of [
        'kasia@example.com',
        stored.friendCode,
        friend.id,
        '98765',
        'Wyprowadź psa',
      ]) {
        expect(raw).not.toContain(secret);
      }
      for (const field of [
        'email',
        'xpTotal',
        'levelProgress',
        'current',
        'friendCode',
        'passwordHash',
        'timezone',
      ]) {
        expect(raw).not.toContain(`"${field}"`);
      }
    });
  });

  describe('ending a friendship', () => {
    it.each(['requester', 'addressee'] as const)(
      'can be done by the %s, and leaves no trace or cooldown',
      async (side) => {
        const [ala, bob] = [await person('ala'), await person('bob')];
        const friendship = await pair(ala, bob);
        const who = side === 'requester' ? ala : bob;
        const other = side === 'requester' ? bob : ala;

        await api().delete(`/friends/${friendship}`).set(who.auth).expect(204);

        expect(await prisma.friendship.count()).toBe(0);
        for (const p of [ala, bob]) {
          expect((await get(p, '/friends')).body).toEqual([]);
          expect(
            (
              (await get(p, '/friends/summary')).body as {
                friendsCount: number;
              }
            ).friendsCount,
          ).toBe(0);
        }
        await get(who, `/friends/${friendship}/profile`).expect(404);
        // Either may ask again at once.
        const { friendCode } = await prisma.user.findUniqueOrThrow({
          where: { id: other.id },
        });
        await api()
          .post('/friends/requests')
          .set(who.auth)
          .send({ code: friendCode })
          .expect(201);
      },
    );
  });

  describe('only the two friends reach a friendship, everyone else gets 404', () => {
    const routes = (id: string) =>
      [
        ['profile', (p: Person) => get(p, `/friends/${id}/profile`)],
        ['badges', (p: Person) => get(p, `/friends/${id}/badges`)],
        ['remove', (p: Person) => api().delete(`/friends/${id}`).set(p.auth)],
      ] as const;

    it('a stranger, even with the friendship id in hand', async () => {
      const [ala, bob, eve] = [await person(), await person(), await person()];
      const friendship = await pair(ala, bob);

      for (const [, call] of routes(friendship)) {
        const body = (await call(eve).expect(404)).body as unknown;
        expect(body).toMatchObject({ code: 'FRIEND_NOT_FOUND' });
      }
      expect(await prisma.friendship.count()).toBe(1);
    });

    it.each(['PENDING', 'DECLINED'] as const)(
      'either side of a %s request: it is not a friendship',
      async (status) => {
        const [ala, bob] = [await person(), await person()];
        const id = await pair(ala, bob, status);

        for (const who of [ala, bob]) {
          for (const [, call] of routes(id)) {
            await call(who).expect(404);
          }
        }
        expect(
          await prisma.friendship.findUniqueOrThrow({ where: { id } }),
        ).toMatchObject({ status });
      },
    );

    it('an id that does not exist, with the very same answer', async () => {
      const [ala, bob, eve] = [await person(), await person(), await person()];
      const friendship = await pair(ala, bob);

      const missing = await get(ala, '/friends/no-such-id/profile').expect(404);
      const foreign = await get(eve, `/friends/${friendship}/profile`).expect(
        404,
      );

      expect(missing.body).toEqual(foreign.body);
    });
  });
});
