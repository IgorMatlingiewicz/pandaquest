import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FRIEND_REQUEST_RATE } from '../src/friends/friends.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearerFor, createApp } from './app';
import { createUser, resetDatabase } from './db';

/*
 * The limit on sending friend requests, over HTTP. Every request here comes
 * from one IP address (supertest on 127.0.0.1), so a limit counted per IP
 * would show as one person's tries blocking another's.
 *
 * The app, and with it the throttler's in-memory store, lives for the whole
 * file; each test uses new accounts, so the counts do not carry over.
 */
describe('the limit on friend requests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());
  const { limit } = FRIEND_REQUEST_RATE;
  const WRONG_CODE = 'ZZZZ2222';

  type Person = Awaited<ReturnType<typeof person>>;
  async function person() {
    const user = await createUser(prisma);
    return { ...user, auth: bearerFor(app, user) };
  }

  const send = (from: Person, code: string) =>
    api().post('/friends/requests').set(from.auth).send({ code });

  /** Uses up the person's tries with codes that lead nowhere. */
  async function useUp(who: Person) {
    for (let i = 0; i < limit; i++) await send(who, WRONG_CODE).expect(404);
  }

  it(`lets ${limit} tries a minute through, good or bad, then answers 429`, async () => {
    const ala = await person();
    const others = await Promise.all(
      Array.from({ length: limit / 2 }, () => person()),
    );

    const first = await send(ala, others[0].friendCode).expect(201);
    expect(first.headers['x-ratelimit-limit']).toBe(String(limit));
    expect(first.headers['x-ratelimit-remaining']).toBe(String(limit - 1));
    for (const other of others.slice(1)) {
      await send(ala, other.friendCode).expect(201);
    }
    for (let i = 0; i < limit / 2; i++) await send(ala, WRONG_CODE).expect(404);

    // A good code does not help once the tries are used up.
    const target = await person();
    const refused = await send(ala, target.friendCode).expect(429);

    expect(refused.body).toEqual({
      statusCode: 429,
      message: 'Za dużo prób, spróbuj za chwilę',
    });
    const retryAfter = Number(refused.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(FRIEND_REQUEST_RATE.ttl / 1000);
    expect(
      await prisma.friendship.count({ where: { addresseeId: target.id } }),
    ).toBe(0);
  });

  it('counts each account on its own, though all come from one IP', async () => {
    const [ala, bob] = [await person(), await person()];
    await useUp(ala);

    await send(bob, ala.friendCode).expect(201);
    await send(ala, bob.friendCode).expect(429);
  });

  it('limits only sending: one who used up the tries can still answer and read', async () => {
    const [ala, bob] = [await person(), await person()];
    const sent = await send(bob, ala.friendCode).expect(201);
    await useUp(ala);

    for (let i = 0; i < limit + 5; i++) {
      await api().get('/friends/requests').set(ala.auth).expect(200);
    }
    await api()
      .post(`/friends/requests/${(sent.body as { id: string }).id}/accept`)
      .set(ala.auth)
      .expect(200);
  });

  it('checks the token first: without one, it is always 401, never 429 or 500', async () => {
    for (let i = 0; i < limit + 5; i++) {
      await api()
        .post('/friends/requests')
        .send({ code: WRONG_CODE })
        .expect(401);
    }
  });
});
