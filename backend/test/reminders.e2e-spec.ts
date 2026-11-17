import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { CycleType, TaskType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { REMINDERS_CLOCK } from '../src/reminders/reminders.clock';
import { MAX_REMINDERS } from '../src/reminders/reminders.config';
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
      expect(await getReminders(me)).toEqual({
        reminders: [
          {
            key: `friend_invite:${fromOla}`,
            type: 'FRIEND_INVITE',
            payload: { count: 1 },
          },
        ],
      });

      const fromKuba = await ask(kuba, me);
      expect((await getReminders(me)).reminders).toEqual([
        {
          key: `friend_invite:${fromKuba}`,
          type: 'FRIEND_INVITE',
          payload: { count: 2 },
        },
        {
          key: `friend_invite:${fromOla}`,
          type: 'FRIEND_INVITE',
          payload: { count: 2 },
        },
      ]);

      await api()
        .post(`/friends/requests/${fromOla}/accept`)
        .set(me.auth)
        .expect(200);
      expect(await keysOf(me)).toEqual([`friend_invite:${fromKuba}`]);

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
        data: { userId: me.id, key: `friend_invite:${old}` },
      });

      expect((await getReminders(me)).reminders).toEqual([
        {
          key: `friend_invite:${fresh}`,
          type: 'FRIEND_INVITE',
          payload: { count: 1 },
        },
      ]);
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
      expect(reminders[0].key).toBe(`friend_invite:${ids[ids.length - 1]}`);
      expect(reminders.every((r) => r.type === 'FRIEND_INVITE')).toBe(true);
      expect(reminders[0].payload).toEqual({ count: MAX_REMINDERS + 2 });
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
