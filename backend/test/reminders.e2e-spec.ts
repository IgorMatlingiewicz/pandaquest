import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { CycleType, TaskType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { REMINDERS_CLOCK } from '../src/reminders/reminders.clock';
import {
  MAX_REMINDERS,
  SHOWN_RETENTION_DAYS,
} from '../src/reminders/reminders.config';
import type { Reminder } from '../src/reminders/reminders.logic';
import { bearerFor, createApp } from './app';
import { createUser, deleteAccount, resetDatabase } from './db';

/*
 * GET /reminders over HTTP on a real Postgres. The reminders' clock is
 * swapped for one the tests set, so 18:59:59 and 19:00:00 can be asked
 * for; everything else runs as in the app.
 */
describe('reminders', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const clock = { now: new Date() };

  beforeAll(
    async () =>
      ({ app, prisma } = await createApp((builder) =>
        builder.overrideProvider(REMINDERS_CLOCK).useValue(() => clock.now),
      )),
  );
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());

  const WARSAW = 'Europe/Warsaw';
  // November in Warsaw is UTC+1: local time = UTC + 1 h.
  const WED_18_59_59 = new Date('2026-11-11T17:59:59Z');
  const WED_19_00 = new Date('2026-11-11T18:00:00Z');
  const THU_19_00 = new Date('2026-11-12T18:00:00Z');
  const SUN_08_00 = new Date('2026-11-15T07:00:00Z');
  const SUN_19_00 = new Date('2026-11-15T18:00:00Z');
  const LONG_AGO = new Date('2026-01-01T00:00:00Z');

  beforeEach(() => {
    clock.now = WED_19_00;
  });

  type Person = {
    id: string;
    auth: { Authorization: string };
    categoryId: string;
  };
  async function person(timezone = WARSAW): Promise<Person> {
    const user = await createUser(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { timezone } });
    const category = await prisma.category.create({
      data: { userId: user.id, name: 'Tajna kategoria' },
    });
    return { id: user.id, auth: bearerFor(app, user), categoryId: category.id };
  }

  const addTask = (
    who: Person,
    type: TaskType,
    extra: { parentTaskId?: string; createdAt?: Date } = {},
  ) =>
    prisma.task.create({
      data: {
        userId: who.id,
        categoryId: who.categoryId,
        title: 'Tajne zadanie',
        type,
        createdAt: LONG_AGO,
        ...extra,
      },
    });
  const markDone = (taskId: string, periodKey: string) =>
    prisma.taskCompletion.create({
      data: {
        taskId,
        periodKey,
        completedAt: LONG_AGO,
        firstCompletedAt: LONG_AGO,
      },
    });
  const fullPeriods = (who: Person, cycleType: CycleType, ...keys: string[]) =>
    prisma.completedPeriod.createMany({
      data: keys.map((periodKey) => ({ userId: who.id, cycleType, periodKey })),
    });

  const getReminders = async (who: Person) =>
    (await api().get('/reminders').set(who.auth).expect(200)).body as {
      reminders: Reminder[];
    };
  const keysOf = async (who: Person) =>
    (await getReminders(who)).reminders.map((r) => r.key);

  /**
   * The reminder key of a friend request, read from the database: its
   * friendship id and the moment it was sent, in milliseconds.
   */
  const inviteKey = async (friendshipId: string) => {
    const { createdAt } = await prisma.friendship.findUniqueOrThrow({
      where: { id: friendshipId },
      select: { createdAt: true },
    });
    return `friend_invite:${friendshipId}:${createdAt.getTime()}`;
  };

  // A friend request sent as the app sends it: by the other one's code.
  const codeOf = async (who: Person) =>
    (
      (await api().get('/friends/code').set(who.auth).expect(200)).body as {
        code: string;
      }
    ).code;
  const ask = async (from: Person, to: Person) =>
    (
      (
        await api()
          .post('/friends/requests')
          .set(from.auth)
          .send({ code: await codeOf(to) })
          .expect(201)
      ).body as { id: string }
    ).id;

  describe('access', () => {
    it('answers 401 without a token', async () => {
      await api().get('/reminders').expect(401);
    });

    it('answers 401 when the account behind the token is gone', async () => {
      const me = await person();
      await deleteAccount(prisma, me.id);

      await api().get('/reminders').set(me.auth).expect(401);
    });
  });

  describe('the evening reminder about daily tasks', () => {
    it('answers an empty list without daily tasks', async () => {
      const me = await person();
      await addTask(me, 'LIFE');

      expect(await getReminders(me)).toEqual({ reminders: [] });
    });

    it('is not there at 18:59:59 and is there at 19:00:00', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      await addTask(me, 'DAILY');

      clock.now = WED_18_59_59;
      expect(await getReminders(me)).toEqual({ reminders: [] });

      clock.now = WED_19_00;
      expect(await getReminders(me)).toEqual({
        reminders: [
          {
            key: 'daily:2026-11-11',
            type: 'DAILY_EVENING',
            payload: { remaining: 2 },
          },
        ],
      });
    });

    it('counts only what is still open', async () => {
      const me = await person();
      const [pills] = [await addTask(me, 'DAILY'), await addTask(me, 'DAILY')];
      await markDone(pills.id, '2026-11-11');

      const [reminder] = (await getReminders(me)).reminders;

      expect(reminder.payload).toEqual({ remaining: 1 });
    });

    it('is not there once every daily task is done', async () => {
      const me = await person();
      await markDone((await addTask(me, 'DAILY')).id, '2026-11-11');

      expect(await keysOf(me)).toEqual([]);
    });

    it('does not count subtasks, as full days do not', async () => {
      const me = await person();
      const parent = await addTask(me, 'DAILY');
      await addTask(me, 'DAILY', { parentTaskId: parent.id });
      await markDone(parent.id, '2026-11-11');

      expect(await keysOf(me)).toEqual([]);
    });

    it('does not count a task added today', async () => {
      const me = await person();
      await addTask(me, 'DAILY', {
        createdAt: new Date('2026-11-11T09:00:00Z'),
      });

      expect(await keysOf(me)).toEqual([]);
    });

    it('is silent once today is in the history, though a task is open', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      await fullPeriods(me, 'DAILY', '2026-11-11');

      expect(await keysOf(me)).toEqual([]);
    });

    it('names the streak at risk, without today', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      await fullPeriods(me, 'DAILY', '2026-11-07', '2026-11-09', '2026-11-10');

      const [reminder] = (await getReminders(me)).reminders;

      expect(reminder.payload).toEqual({
        remaining: 1,
        atRiskStreak: { unit: 'DAY', length: 2 },
      });
    });

    it('leaves the streak out when yesterday was missed', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      await fullPeriods(me, 'DAILY', '2026-11-09');

      const [reminder] = (await getReminders(me)).reminders;

      expect(reminder.payload).toEqual({ remaining: 1 });
    });

    it('stays away the rest of the day once confirmed, and is back the next', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      await prisma.reminderShown.create({
        data: { userId: me.id, key: 'daily:2026-11-11' },
      });

      expect(await keysOf(me)).toEqual([]);

      clock.now = THU_19_00;
      expect(await keysOf(me)).toEqual(['daily:2026-11-12']);
    });

    it("goes by the user's own timezone", async () => {
      // 00:00 UTC: 19:00 the day before in New York, 01:00 in Warsaw.
      clock.now = new Date('2026-11-12T00:00:00Z');
      const [newYork, warsaw] = [
        await person('America/New_York'),
        await person(WARSAW),
      ];
      await addTask(newYork, 'DAILY');
      await addTask(warsaw, 'DAILY');

      expect(await keysOf(newYork)).toEqual(['daily:2026-11-11']);
      expect(await keysOf(warsaw)).toEqual([]);
    });

    it('goes once the last daily task is checked in the app', async () => {
      // The real clock this time, as the task routes use it. The timezone
      // is picked so that it is between 20:00 and 21:00 there now, well
      // inside the evening, whatever hour the tests run at.
      clock.now = new Date();
      let offset = 20 - clock.now.getUTCHours();
      if (offset > 14) offset -= 24;
      // Etc/GMT names count the other way: Etc/GMT-5 is UTC+5.
      const zone =
        offset === 0
          ? 'Etc/GMT'
          : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
      const me = await person(zone);
      const [first, second] = [
        await addTask(me, 'DAILY'),
        await addTask(me, 'DAILY'),
      ];
      const check = (id: string) =>
        api()
          .patch(`/tasks/${id}`)
          .set(me.auth)
          .send({ status: 'COMPLETED' })
          .expect(200);

      expect((await getReminders(me)).reminders[0].payload).toEqual({
        remaining: 2,
      });
      await check(first.id);
      expect((await getReminders(me)).reminders[0].payload).toEqual({
        remaining: 1,
      });
      await check(second.id);
      expect(await keysOf(me)).toEqual([]);
    });
  });

  describe('the reminder on the last day of the week', () => {
    it('is there all Sunday, before the evening one starts', async () => {
      const me = await person();
      await addTask(me, 'WEEKLY');
      await addTask(me, 'DAILY');

      clock.now = SUN_08_00;
      expect(await keysOf(me)).toEqual(['weekly:2026-W46']);

      clock.now = SUN_19_00;
      expect(await keysOf(me)).toEqual(['daily:2026-11-15', 'weekly:2026-W46']);
    });

    it('is not there on other days', async () => {
      const me = await person();
      await addTask(me, 'WEEKLY');

      expect(await keysOf(me)).toEqual([]);
    });

    it('names the weekly streak at risk', async () => {
      const me = await person();
      await addTask(me, 'WEEKLY');
      await fullPeriods(me, 'WEEKLY', '2026-W44', '2026-W45');
      clock.now = SUN_19_00;

      expect(await getReminders(me)).toEqual({
        reminders: [
          {
            key: 'weekly:2026-W46',
            type: 'WEEKLY_LAST_DAY',
            payload: {
              remaining: 1,
              atRiskStreak: { unit: 'WEEK', length: 2 },
            },
          },
        ],
      });
    });

    it('is not there once the week is done', async () => {
      const me = await person();
      await markDone((await addTask(me, 'WEEKLY')).id, '2026-W46');
      clock.now = SUN_19_00;

      expect(await keysOf(me)).toEqual([]);
    });
  });

  describe('friend requests', () => {
    it('follows the requests through the app: sent, accepted, declined', async () => {
      const me = await person();
      const [ola, kuba] = [await person(), await person()];

      const fromOla = await ask(ola, me);
      const olaKey = await inviteKey(fromOla);
      expect(await getReminders(me)).toEqual({
        reminders: [
          { key: olaKey, type: 'FRIEND_INVITE', payload: { count: 1 } },
        ],
      });

      const fromKuba = await ask(kuba, me);
      const kubaKey = await inviteKey(fromKuba);
      expect((await getReminders(me)).reminders).toEqual([
        { key: kubaKey, type: 'FRIEND_INVITE', payload: { count: 2 } },
        { key: olaKey, type: 'FRIEND_INVITE', payload: { count: 2 } },
      ]);

      await api()
        .post(`/friends/requests/${fromOla}/accept`)
        .set(me.auth)
        .expect(200);
      expect(await keysOf(me)).toEqual([kubaKey]);

      await api()
        .post(`/friends/requests/${fromKuba}/decline`)
        .set(me.auth)
        .expect(200);
      expect(await keysOf(me)).toEqual([]);
    });

    it('is not shown to the one who asked', async () => {
      const [me, other] = [await person(), await person()];
      await ask(me, other);

      expect(await keysOf(me)).toEqual([]);
    });

    it('goes when the one who asked takes the request back', async () => {
      const [me, other] = [await person(), await person()];
      const id = await ask(other, me);

      await api().delete(`/friends/requests/${id}`).set(other.auth).expect(204);

      expect(await keysOf(me)).toEqual([]);
    });

    it('counts only the requests not confirmed yet', async () => {
      const me = await person();
      const old = await ask(await person(), me);
      const fresh = await ask(await person(), me);
      await prisma.reminderShown.create({
        data: { userId: me.id, key: await inviteKey(old) },
      });

      expect((await getReminders(me)).reminders).toEqual([
        {
          key: await inviteKey(fresh),
          type: 'FRIEND_INVITE',
          payload: { count: 1 },
        },
      ]);
    });

    it('reminds once more of a request sent again after a decline', async () => {
      // As the app goes: shown and confirmed, declined, sent again.
      const [me, ola] = [await person(), await person()];
      const first = await ask(ola, me);
      const firstKey = await inviteKey(first);
      const shown = (await getReminders(me)).reminders.map((r) => r.key);
      await api()
        .post('/reminders/ack')
        .set(me.auth)
        .send({ keys: shown })
        .expect(204);
      expect(await keysOf(me)).toEqual([]);
      await api()
        .post(`/friends/requests/${first}/decline`)
        .set(me.auth)
        .expect(200);
      // Past the cooldown on asking again, counted from the answer.
      await prisma.friendship.update({
        where: { id: first },
        data: { respondedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      });

      const again = await ask(ola, me);
      const againKey = await inviteKey(again);

      // One row per pair: the same friendship, sent at a new moment.
      expect(again).toBe(first);
      expect(againKey).not.toBe(firstKey);
      const { reminders } = await getReminders(me);
      expect(reminders.map((r) => [r.type, r.payload])).toEqual([
        ['FRIEND_INVITE', { count: 1 }],
      ]);
      expect(reminders[0].key).toBe(againKey);
    });

    it(`returns at most ${MAX_REMINDERS}, the newest first, with the true count`, async () => {
      const me = await person();
      const ids: string[] = [];
      for (let i = 0; i < MAX_REMINDERS + 2; i++) {
        const from = await createUser(prisma);
        const row = await prisma.friendship.create({
          data: {
            requesterId: from.id,
            addresseeId: me.id,
            createdAt: new Date(Date.UTC(2026, 10, 1, i)),
          },
        });
        ids.push(row.id);
      }

      const { reminders } = await getReminders(me);

      expect(reminders).toHaveLength(MAX_REMINDERS);
      expect(reminders[0].key).toBe(await inviteKey(ids[ids.length - 1]));
      expect(reminders.every((r) => r.type === 'FRIEND_INVITE')).toBe(true);
      expect(reminders[0].payload).toEqual({ count: MAX_REMINDERS + 2 });
    });
  });

  describe('POST /reminders/ack', () => {
    const ack = (who: Person, body: unknown) =>
      api()
        .post('/reminders/ack')
        .set(who.auth)
        .send(body as object);
    const rowsOf = (who: Person) =>
      prisma.reminderShown.findMany({
        where: { userId: who.id },
        orderBy: { key: 'asc' },
      });
    const DAY = 24 * 60 * 60 * 1000;
    const daysBefore = (days: number) =>
      new Date(clock.now.getTime() - days * DAY);

    it('answers 401 without a token, and when the account is gone', async () => {
      await api()
        .post('/reminders/ack')
        .send({ keys: ['daily:2026-11-11'] })
        .expect(401);

      const me = await person();
      await deleteAccount(prisma, me.id);
      await ack(me, { keys: ['daily:2026-11-11'] }).expect(401);
    });

    it('answers 204 and hides the reminder the rest of the day; the next day has its own', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      const [shown] = (await getReminders(me)).reminders;

      const res = await ack(me, { keys: [shown.key] }).expect(204);

      expect(res.text).toBe('');
      expect(await keysOf(me)).toEqual([]);
      clock.now = new Date('2026-11-11T22:59:59Z'); // 23:59:59
      expect(await keysOf(me)).toEqual([]);
      clock.now = THU_19_00;
      expect(await keysOf(me)).toEqual(['daily:2026-11-12']);
    });

    it('stores the moment from the clock', async () => {
      const me = await person();

      await ack(me, { keys: ['daily:2026-11-11'] }).expect(204);

      expect(await rowsOf(me)).toEqual([
        expect.objectContaining({
          key: 'daily:2026-11-11',
          shownAt: WED_19_00,
        }),
      ]);
    });

    it('confirms every friend request at once, and a new one shows again', async () => {
      const me = await person();
      await ask(await person(), me);
      await ask(await person(), me);
      const keys = (await getReminders(me)).reminders.map((r) => r.key);

      await ack(me, { keys }).expect(204);
      expect(await keysOf(me)).toEqual([]);

      const fresh = await ask(await person(), me);
      expect((await getReminders(me)).reminders).toEqual([
        {
          key: await inviteKey(fresh),
          type: 'FRIEND_INVITE',
          payload: { count: 1 },
        },
      ]);
    });

    describe('is idempotent', () => {
      it('the same keys twice: 204 both times, one row each', async () => {
        const me = await person();
        const keys = ['daily:2026-11-11', 'weekly:2026-W46'];

        await ack(me, { keys }).expect(204);
        await ack(me, { keys }).expect(204);

        expect((await rowsOf(me)).map((r) => r.key)).toEqual(keys);
      });

      it('the same key twice in one request: one row', async () => {
        const me = await person();

        await ack(me, {
          keys: ['daily:2026-11-11', 'daily:2026-11-11'],
        }).expect(204);

        expect(await rowsOf(me)).toHaveLength(1);
      });

      it('keeps the first moment when a key comes again', async () => {
        const me = await person();
        await ack(me, { keys: ['daily:2026-11-11'] }).expect(204);
        clock.now = new Date('2026-11-11T20:00:00Z');

        await ack(me, { keys: ['daily:2026-11-11'] }).expect(204);

        expect((await rowsOf(me))[0].shownAt).toEqual(WED_19_00);
      });

      it('two phones at the same moment: both 204, one row per key', async () => {
        // Ten rounds of five requests at once, with overlapping keys. The
        // unique index decides: ON CONFLICT DO NOTHING waits for the other
        // transaction and then skips, so no request fails.
        for (let round = 0; round < 10; round++) {
          const me = await person();
          const bodies = [
            ['daily:2026-11-11'],
            ['daily:2026-11-11'],
            ['daily:2026-11-11', 'weekly:2026-W46'],
            ['weekly:2026-W46', 'daily:2026-11-11'],
            ['weekly:2026-W46'],
          ];

          const responses = await Promise.all(
            bodies.map((keys) => ack(me, { keys })),
          );

          expect(responses.map((r) => r.status)).toEqual([
            204, 204, 204, 204, 204,
          ]);
          expect((await rowsOf(me)).map((r) => r.key)).toEqual([
            'daily:2026-11-11',
            'weekly:2026-W46',
          ]);
        }
      });
    });

    it(`takes exactly ${MAX_REMINDERS} keys`, async () => {
      const me = await person();
      const keys = Array.from(
        { length: MAX_REMINDERS },
        (_, i) => `daily:2026-11-${String(i + 1).padStart(2, '0')}`,
      );

      await ack(me, { keys }).expect(204);

      expect(await rowsOf(me)).toHaveLength(MAX_REMINDERS);
    });

    it.each([
      ['no body', undefined],
      ['no keys', {}],
      ['keys that are not a list', { keys: 'daily:2026-11-11' }],
      ['an empty list', { keys: [] }],
      [
        `${MAX_REMINDERS + 1} keys`,
        {
          keys: Array.from(
            { length: MAX_REMINDERS + 1 },
            (_, i) => `daily:2026-11-${String(i + 1).padStart(2, '0')}`,
          ),
        },
      ],
      ['a number', { keys: [20261111] }],
      ['null', { keys: [null] }],
      ['an unknown prefix', { keys: ['monthly:2026-11'] }],
      ['a malformed day', { keys: ['daily:2026-11-1'] }],
      ['a malformed week', { keys: ['weekly:2026-46'] }],
      ['a friend request that is not a UUID', { keys: ['friend_invite:1:1'] }],
      [
        'a friend request without its moment',
        { keys: ['friend_invite:3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b'] },
      ],
      [
        'one bad key among good ones',
        { keys: ['daily:2026-11-11', 'weekly:2026-W46', 'oops'] },
      ],
    ])('answers 400 to %s and stores nothing', async (_, body) => {
      const me = await person();

      await ack(me, body).expect(400);

      expect(await rowsOf(me)).toEqual([]);
    });

    it('writes only for the caller', async () => {
      const [me, other] = [await person(), await person()];
      await addTask(other, 'DAILY');
      // A key of someone else's friend request hides nothing for them.
      const theirs = await inviteKey(await ask(await person(), other));

      await ack(me, { keys: ['daily:2026-11-11', theirs] }).expect(204);

      expect(
        await prisma.reminderShown.count({ where: { userId: other.id } }),
      ).toBe(0);
      expect(await keysOf(other)).toEqual(['daily:2026-11-11', theirs]);
    });

    describe(`removes rows older than ${SHOWN_RETENTION_DAYS} days`, () => {
      it('keeps the younger ones and those of requests still waiting', async () => {
        const me = await person();
        const waiting = await ask(await person(), me);
        const accepted = await ask(await person(), me);
        const waitingKey = await inviteKey(waiting);
        const acceptedKey = await inviteKey(accepted);
        await api()
          .post(`/friends/requests/${accepted}/accept`)
          .set(me.auth)
          .expect(200);
        await prisma.reminderShown.createMany({
          data: [
            { key: 'daily:2026-10-01', shownAt: daysBefore(41) },
            { key: 'weekly:2026-W41', shownAt: daysBefore(31) },
            { key: 'daily:2026-10-14', shownAt: daysBefore(29) },
            { key: waitingKey, shownAt: daysBefore(60) },
            { key: acceptedKey, shownAt: daysBefore(60) },
            // An earlier sending of the waiting one, declined since: only
            // the key of the current sending is kept.
            { key: `friend_invite:${waiting}:1`, shownAt: daysBefore(60) },
          ].map((row) => ({ ...row, userId: me.id })),
        });

        await ack(me, { keys: ['daily:2026-11-11'] }).expect(204);

        expect((await rowsOf(me)).map((r) => r.key)).toEqual([
          'daily:2026-10-14',
          'daily:2026-11-11',
          waitingKey,
        ]);
        // The waiting request stays confirmed: no reminder comes back.
        expect(await keysOf(me)).toEqual([]);
      });

      it('leaves other users’ rows alone', async () => {
        const [me, other] = [await person(), await person()];
        await prisma.reminderShown.create({
          data: {
            userId: other.id,
            key: 'daily:2026-09-01',
            shownAt: daysBefore(70),
          },
        });

        await ack(me, { keys: ['daily:2026-11-11'] }).expect(204);

        expect(
          await prisma.reminderShown.count({ where: { userId: other.id } }),
        ).toBe(1);
      });
    });
  });

  describe('privacy and side effects', () => {
    it('names no task, category or person, only numbers', async () => {
      const me = await person();
      const asker = await person();
      await prisma.user.update({
        where: { id: asker.id },
        data: { username: 'Tajny Znajomy' },
      });
      await addTask(me, 'DAILY');
      await addTask(me, 'WEEKLY');
      await ask(asker, me);
      clock.now = SUN_19_00;

      const body = await getReminders(me);
      const text = JSON.stringify(body);

      expect(body.reminders).toHaveLength(3);
      for (const secret of [
        'Tajne zadanie',
        'Tajna kategoria',
        'Tajny Znajomy',
        asker.id,
        await codeOf(asker),
      ]) {
        expect(text).not.toContain(secret);
      }
    });

    it('sees only its own data', async () => {
      const [me, other] = [await person(), await person()];
      await addTask(other, 'DAILY');
      await ask(await person(), other);
      await addTask(me, 'DAILY');
      await prisma.reminderShown.create({
        data: { userId: other.id, key: 'daily:2026-11-11' },
      });

      expect(await getReminders(me)).toEqual({
        reminders: [
          {
            key: 'daily:2026-11-11',
            type: 'DAILY_EVENING',
            payload: { remaining: 1 },
          },
        ],
      });
    });

    it('changes nothing by reading: the same answer twice, no row written', async () => {
      const me = await person();
      await addTask(me, 'DAILY');
      await ask(await person(), me);

      const first = await getReminders(me);
      const second = await getReminders(me);

      expect(second).toEqual(first);
      expect(first.reminders).toHaveLength(2);
      expect(await prisma.reminderShown.count()).toBe(0);
    });
  });
});
