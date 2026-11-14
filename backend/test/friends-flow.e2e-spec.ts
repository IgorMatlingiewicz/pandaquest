import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { formatFriendCode } from '../src/friends/friend-code';
import { PrismaService } from '../src/prisma/prisma.service';
import { account, createApp } from './app';
import { resetDatabase } from './db';

/*
 * The whole friends story as the app would go through it: only HTTP, from
 * sign-up on, no shortcuts through the database. The other files test each
 * rule on its own; this one shows the routes fit together.
 */
describe('friends, from sign-up to goodbye', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());
  type Account = Awaited<ReturnType<typeof account>>;

  const get = async (who: Account, path: string) =>
    (await api().get(path).set(who.auth).expect(200)).body as unknown;
  const codeOf = async (who: Account) =>
    ((await get(who, '/friends/code')) as { code: string }).code;
  const send = (from: Account, code: string) =>
    api().post('/friends/requests').set(from.auth).send({ code });
  const friendsOf = async (who: Account) =>
    (await get(who, '/friends')) as {
      friendshipId: string;
      username: string;
      level: number;
    }[];

  it('finds a friend by code, sees their profile, and parts', async () => {
    const ala = await account(app, 'ala@example.com', 'Ala');
    const bartek = await account(app, 'bartek@example.com', 'Bartek');

    // Ala reads her code to Bartek; he types it in small letters.
    const alaCode = await codeOf(ala);
    const sent = await send(
      bartek,
      formatFriendCode(alaCode).toLowerCase(),
    ).expect(201);
    const requestId = (sent.body as { id: string }).id;

    expect(await get(ala, '/friends/summary')).toEqual({
      friendsCount: 0,
      pendingIncomingCount: 1,
    });
    expect(await get(ala, '/friends/requests')).toMatchObject({
      incoming: [{ id: requestId, user: { username: 'Bartek', level: 1 } }],
      outgoing: [],
    });

    await api()
      .post(`/friends/requests/${requestId}/accept`)
      .set(ala.auth)
      .expect(200);

    // Both see each other, under the same friendship.
    const [alaFriends, bartekFriends] = [
      await friendsOf(ala),
      await friendsOf(bartek),
    ];
    expect(alaFriends).toEqual([
      {
        friendshipId: expect.any(String) as string,
        username: 'Bartek',
        level: 1,
      },
    ]);
    expect(bartekFriends).toEqual([
      { friendshipId: alaFriends[0].friendshipId, username: 'Ala', level: 1 },
    ]);
    const friendship = alaFriends[0].friendshipId;

    // Bartek looks at Ala: the friend view, the same as Ala's own numbers.
    const profile = (await get(
      bartek,
      `/friends/${friendship}/profile`,
    )) as Record<string, unknown>;
    const own = (await get(ala, '/profile')) as Record<string, unknown>;
    expect(profile).toEqual({
      username: 'Ala',
      level: 1,
      joinedAt: own.joinedAt,
      badges: own.badges,
      favorites: own.favorites,
    });
    expect(
      Array.isArray(await get(bartek, `/friends/${friendship}/badges`)),
    ).toBe(true);

    // Ala draws a new code: the old one leads nowhere, the friendship stays.
    const { code: newCode } = (
      await api().post('/friends/code/regenerate').set(ala.auth).expect(200)
    ).body as { code: string };
    expect(newCode).not.toBe(alaCode);
    const celina = await account(app, 'celina@example.com', 'Celina');
    const stale = (await send(celina, alaCode).expect(404)).body as unknown;
    expect(stale).toMatchObject({ code: 'INVALID_FRIEND_CODE' });
    expect(await friendsOf(bartek)).toHaveLength(1);

    // Bartek ends it; nothing is left, and Ala may ask again at once.
    await api().delete(`/friends/${friendship}`).set(bartek.auth).expect(204);
    for (const who of [ala, bartek]) {
      expect(await friendsOf(who)).toEqual([]);
      expect(await get(who, '/friends/summary')).toEqual({
        friendsCount: 0,
        pendingIncomingCount: 0,
      });
    }
    await api().get(`/friends/${friendship}/profile`).set(ala.auth).expect(404);
    await send(ala, await codeOf(bartek)).expect(201);
  });
});
