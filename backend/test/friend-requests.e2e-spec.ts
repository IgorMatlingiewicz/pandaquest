import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { formatFriendCode } from '../src/friends/friend-code';
import {
  MAX_FRIENDS,
  MAX_PENDING_OUTGOING,
  RESEND_COOLDOWN_MS,
} from '../src/friends/friends.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearerFor, createApp } from './app';
import { createUser, resetDatabase } from './db';

/*
 * Friend requests over HTTP on a real Postgres: the whole flow, the race of
 * two people asking each other at once, the cooldown, the limits, and who
 * may act on which request.
 */
describe('friend requests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());

  type Person = Awaited<ReturnType<typeof person>>;
  async function person(username = 'panda', level = 1) {
    const user = await createUser(prisma, { username });
    if (level !== 1) {
      await prisma.user.update({ where: { id: user.id }, data: { level } });
    }
    return { ...user, auth: bearerFor(app, user) };
  }

  const send = (from: Person, code: string) =>
    api().post('/friends/requests').set(from.auth).send({ code });
  const list = async (who: Person) =>
    (await api().get('/friends/requests').set(who.auth).expect(200)).body as {
      incoming: Record<string, unknown>[];
      outgoing: Record<string, unknown>[];
    };
  const summary = async (who: Person) =>
    (await api().get('/friends/summary').set(who.auth).expect(200)).body as {
      friendsCount: number;
      pendingIncomingCount: number;
    };
  const answer = (who: Person, id: string, verb: 'accept' | 'decline') =>
    api().post(`/friends/requests/${id}/${verb}`).set(who.auth);
  const cancel = (who: Person, id: string) =>
    api().delete(`/friends/requests/${id}`).set(who.auth);
  const idOf = (body: unknown) => (body as { id: string }).id;
  const pairRows = () => prisma.friendship.findMany();

  it('answers 401 without a token on every route', async () => {
    const id = '00000000-0000-0000-0000-000000000000';
    await api()
      .post('/friends/requests')
      .send({ code: 'ABCDEFGH' })
      .expect(401);
    await api().get('/friends/requests').expect(401);
    await api().get('/friends/summary').expect(401);
    await api().post(`/friends/requests/${id}/accept`).expect(401);
    await api().post(`/friends/requests/${id}/decline`).expect(401);
    await api().delete(`/friends/requests/${id}`).expect(401);
  });

  it('goes from a request to a friendship, as both sides see it', async () => {
    const ala = await person('ala', 3);
    const bob = await person('bob', 5);

    const sent = await send(ala, bob.friendCode).expect(201);
    expect(sent.body).toEqual({
      id: expect.any(String) as string,
      status: 'PENDING',
      autoAccepted: false,
    });

    const bobSees = await list(bob);
    expect(bobSees.incoming).toEqual([
      {
        id: idOf(sent.body),
        user: { username: 'ala', level: 3 },
        status: 'PENDING',
        createdAt: expect.any(String) as string,
      },
    ]);
    expect(bobSees.outgoing).toEqual([]);
    expect((await list(ala)).outgoing).toEqual([
      expect.objectContaining({ user: { username: 'bob', level: 5 } }),
    ]);
    expect(await summary(bob)).toEqual({
      friendsCount: 0,
      pendingIncomingCount: 1,
    });

    const accepted = await answer(bob, idOf(sent.body), 'accept').expect(200);
    expect(accepted.body).toEqual({ id: idOf(sent.body), status: 'ACCEPTED' });

    for (const who of [ala, bob]) {
      expect(await summary(who)).toEqual({
        friendsCount: 1,
        pendingIncomingCount: 0,
      });
      expect(await list(who)).toEqual({ incoming: [], outgoing: [] });
    }
    const [row] = await pairRows();
    expect(row.respondedAt).not.toBeNull();
  });

  it('takes the code as people type it: dashes, spaces, small letters', async () => {
    const ala = await person();
    const bob = await person();
    const typed = ` ${formatFriendCode(bob.friendCode).toLowerCase()} `;

    await send(ala, typed).expect(201);
  });

  describe('refuses', () => {
    it('an unknown code and a malformed one with the very same 404', async () => {
      const ala = await person();

      const unknown = await send(ala, 'ZZZZ2222').expect(404);
      const malformed = await send(ala, 'not a code!').expect(404);

      expect(unknown.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        code: 'INVALID_FRIEND_CODE',
        message: expect.any(String) as string,
      });
      expect(malformed.body).toEqual(unknown.body);
    });

    it('a body without a code as a bad request', async () => {
      const ala = await person();

      await api().post('/friends/requests').set(ala.auth).send({}).expect(400);
    });

    it('one’s own code with 400', async () => {
      const ala = await person();

      const body = (await send(ala, ala.friendCode).expect(400))
        .body as unknown;

      expect(body).toMatchObject({ code: 'CANNOT_ADD_SELF' });
    });

    it('a second request the same way while the first waits', async () => {
      const [ala, bob] = [await person(), await person()];
      await send(ala, bob.friendCode).expect(201);

      const body = (await send(ala, bob.friendCode).expect(409))
        .body as unknown;

      expect(body).toMatchObject({ code: 'REQUEST_ALREADY_SENT' });
      expect(await pairRows()).toHaveLength(1);
    });

    it('a request between friends, whichever of them asks', async () => {
      const [ala, bob] = [await person(), await person()];
      const sent = await send(ala, bob.friendCode).expect(201);
      await answer(bob, idOf(sent.body), 'accept').expect(200);

      for (const [from, to] of [
        [ala, bob],
        [bob, ala],
      ]) {
        const body = (await send(from, to.friendCode).expect(409))
          .body as unknown;
        expect(body).toMatchObject({ code: 'ALREADY_FRIENDS' });
      }
    });
  });

  it('accepts at once when the other side has already asked', async () => {
    const [ala, bob] = [await person(), await person()];
    const first = await send(ala, bob.friendCode).expect(201);

    const second = await send(bob, ala.friendCode).expect(201);

    expect(second.body).toEqual({
      id: idOf(first.body),
      status: 'ACCEPTED',
      autoAccepted: true,
    });
    const [row] = await pairRows();
    expect(row).toMatchObject({ status: 'ACCEPTED', requesterId: ala.id });
    expect(row.respondedAt).not.toBeNull();
  });

  it('ends with exactly one friendship when two people ask each other at the same moment', async () => {
    const rounds = 15;
    for (let round = 0; round < rounds; round++) {
      const [ala, bob] = [await person(), await person()];

      const responses = await Promise.all([
        send(ala, bob.friendCode),
        send(bob, ala.friendCode),
      ]);

      expect(responses.map((r) => r.status)).toEqual([201, 201]);
      const rows = await prisma.friendship.findMany({
        where: { OR: [{ requesterId: ala.id }, { requesterId: bob.id }] },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('ACCEPTED');
      expect(
        responses.filter(
          (r) => (r.body as { autoAccepted: boolean }).autoAccepted,
        ),
      ).toHaveLength(1);
    }
  });

  describe('after a decline', () => {
    async function declined() {
      const [ala, bob] = [await person('ala'), await person('bob')];
      const sent = await send(ala, bob.friendCode).expect(201);
      const id = idOf(sent.body);
      await answer(bob, id, 'decline').expect(200);
      const row = await prisma.friendship.findUniqueOrThrow({ where: { id } });
      return { ala, bob, id, respondedAt: row.respondedAt! };
    }

    it('shows the sender the decline and when they may ask again', async () => {
      const { ala, bob, id, respondedAt } = await declined();
      const availableAt = new Date(
        respondedAt.getTime() + RESEND_COOLDOWN_MS,
      ).toISOString();

      expect((await list(ala)).outgoing).toEqual([
        {
          id,
          user: { username: 'bob', level: 1 },
          status: 'DECLINED',
          createdAt: expect.any(String) as string,
          resendAvailableAt: availableAt,
        },
      ]);
      expect((await list(bob)).incoming).toEqual([]);
    });

    it('refuses the sender for 7 days, saying when they may', async () => {
      const { ala, bob, respondedAt } = await declined();

      const body = (await send(ala, bob.friendCode).expect(409))
        .body as unknown;

      expect(body).toMatchObject({
        code: 'FRIEND_REQUEST_COOLDOWN',
        availableAt: new Date(
          respondedAt.getTime() + RESEND_COOLDOWN_MS,
        ).toISOString(),
      });
    });

    it('lets the sender ask again after 7 days, on the same row', async () => {
      const { ala, bob, id } = await declined();
      const longAgo = new Date(Date.now() - RESEND_COOLDOWN_MS - 60_000);
      await prisma.friendship.update({
        where: { id },
        data: { respondedAt: longAgo, createdAt: longAgo },
      });
      expect((await list(ala)).outgoing).toEqual([]);

      const again = await send(ala, bob.friendCode).expect(201);

      expect(again.body).toEqual({
        id,
        status: 'PENDING',
        autoAccepted: false,
      });
      const row = await prisma.friendship.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: 'PENDING', respondedAt: null });
      expect(row.createdAt.getTime()).toBeGreaterThan(longAgo.getTime());
      expect(await pairRows()).toHaveLength(1);
    });

    it('lets the one who declined ask at any time; the row turns round', async () => {
      const { ala, bob, id } = await declined();

      const theirs = await send(bob, ala.friendCode).expect(201);

      expect(theirs.body).toEqual({
        id,
        status: 'PENDING',
        autoAccepted: false,
      });
      expect(
        await prisma.friendship.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        requesterId: bob.id,
        addresseeId: ala.id,
        respondedAt: null,
      });
      expect((await list(ala)).incoming).toEqual([
        expect.objectContaining({ id, user: { username: 'bob', level: 1 } }),
      ]);
      await answer(ala, id, 'accept').expect(200);
      expect((await summary(bob)).friendsCount).toBe(1);
    });
  });

  describe('taking a request back', () => {
    it('removes it without a trace, so it can be sent again at once', async () => {
      const [ala, bob] = [await person(), await person()];
      const sent = await send(ala, bob.friendCode).expect(201);

      await cancel(ala, idOf(sent.body)).expect(204);

      expect(await pairRows()).toEqual([]);
      expect((await list(bob)).incoming).toEqual([]);
      await answer(bob, idOf(sent.body), 'accept').expect(404);
      await send(ala, bob.friendCode).expect(201);
    });
  });

  describe('only the right person acts on a request, others get 404', () => {
    async function pending() {
      const [ala, bob, eve] = [await person(), await person(), await person()];
      const sent = await send(ala, bob.friendCode).expect(201);
      return { ala, bob, eve, id: idOf(sent.body) };
    }
    const notFound = { code: 'REQUEST_NOT_FOUND' };

    it('the sender cannot accept or decline their own request', async () => {
      const { ala, id } = await pending();

      for (const verb of ['accept', 'decline'] as const) {
        const body = (await answer(ala, id, verb).expect(404)).body as unknown;
        expect(body).toMatchObject(notFound);
      }
    });

    it('the addressee cannot take back somebody else’s request', async () => {
      const { bob, id } = await pending();

      const body = (await cancel(bob, id).expect(404)).body as unknown;

      expect(body).toMatchObject(notFound);
    });

    it('a stranger can do nothing with it, as if it did not exist', async () => {
      const { eve, id } = await pending();

      await answer(eve, id, 'accept').expect(404);
      await answer(eve, id, 'decline').expect(404);
      await cancel(eve, id).expect(404);
      expect((await pairRows())[0].status).toBe('PENDING');
    });

    it('nobody can answer a request twice', async () => {
      const { bob, id } = await pending();
      await answer(bob, id, 'accept').expect(200);

      await answer(bob, id, 'accept').expect(404);
      await answer(bob, id, 'decline').expect(404);
      expect((await pairRows())[0].status).toBe('ACCEPTED');
    });

    it('an id that does not exist is the same 404', async () => {
      const { bob } = await pending();

      const body = (await answer(bob, 'no-such-id', 'accept').expect(404))
        .body as unknown;

      expect(body).toMatchObject(notFound);
    });
  });

  describe('limits', () => {
    /** Many users at once, straight in the database. */
    async function users(count: number) {
      const made = await Promise.all(
        Array.from({ length: count }, () => createUser(prisma)),
      );
      return made.map((u) => u.id);
    }

    it(`refuses a ${MAX_PENDING_OUTGOING + 1}st request that waits`, async () => {
      const ala = await person();
      const others = await users(MAX_PENDING_OUTGOING);
      await prisma.friendship.createMany({
        data: others.map((addresseeId) => ({
          requesterId: ala.id,
          addresseeId,
        })),
      });
      const bob = await person();

      const body = (await send(ala, bob.friendCode).expect(409))
        .body as unknown;

      expect(body).toMatchObject({ code: 'TOO_MANY_PENDING_REQUESTS' });
    });

    it(`refuses a request from someone with ${MAX_FRIENDS} friends`, async () => {
      const ala = await person();
      const friends = await users(MAX_FRIENDS);
      await prisma.friendship.createMany({
        data: friends.map((addresseeId) => ({
          requesterId: ala.id,
          addresseeId,
          status: 'ACCEPTED' as const,
          respondedAt: new Date(),
        })),
      });
      const bob = await person();

      const body = (await send(ala, bob.friendCode).expect(409))
        .body as unknown;

      expect(body).toMatchObject({ code: 'FRIEND_LIMIT_REACHED' });
    });

    it(`refuses to accept when the addressee already has ${MAX_FRIENDS} friends`, async () => {
      const [ala, bob] = [await person(), await person()];
      const sent = await send(ala, bob.friendCode).expect(201);
      const friends = await users(MAX_FRIENDS);
      await prisma.friendship.createMany({
        data: friends.map((requesterId) => ({
          requesterId,
          addresseeId: bob.id,
          status: 'ACCEPTED' as const,
          respondedAt: new Date(),
        })),
      });

      const body = (await answer(bob, idOf(sent.body), 'accept').expect(409))
        .body as unknown;

      expect(body).toMatchObject({ code: 'FRIEND_LIMIT_REACHED' });
      expect(
        await prisma.friendship.findUniqueOrThrow({
          where: { id: idOf(sent.body) },
        }),
      ).toMatchObject({ status: 'PENDING' });
    });
  });

  it('never shows an email, a code, XP or anything else of the other side', async () => {
    const [ala, bob] = [await person('ala'), await person('bob')];
    await send(ala, bob.friendCode).expect(201);

    const raw = JSON.stringify([await list(ala), await list(bob)]);

    for (const secret of [
      ala.email,
      bob.email,
      ala.friendCode,
      bob.friendCode,
    ]) {
      expect(raw).not.toContain(secret);
    }
    for (const field of [
      'email',
      'friendCode',
      'xpTotal',
      'passwordHash',
      'requesterId',
      'addresseeId',
    ]) {
      expect(raw).not.toContain(`"${field}"`);
    }
  });
});
