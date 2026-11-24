import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearerFor, createApp, PASSWORD } from './app';
import { createUser, resetDatabase } from './db';

/*
 * Fields the client may not set. Several services copy the whole DTO into
 * Prisma (...dto), so without the ValidationPipe's whitelist any column
 * named in the body would be written: a category moved to someone else, a
 * custom one made cyclic, a task back-dated. Each test sends such fields
 * over HTTP and reads what the database holds.
 */
describe('fields the client may not set', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());
  const LONG_AGO = '2020-01-01T00:00:00.000Z';
  const recently = () => new Date(Date.now() - 60_000);

  async function person() {
    const user = await createUser(prisma);
    return { id: user.id, auth: bearerFor(app, user) };
  }
  const newCategory = async (who: { auth: { Authorization: string } }) =>
    (
      (
        await api()
          .post('/categories')
          .set(who.auth)
          .send({ name: 'Sport' })
          .expect(201)
      ).body as { id: string }
    ).id;

  describe('POST /categories', () => {
    it('ignores the owner, cycle type and flags sent with a new category', async () => {
      const [me, other] = [await person(), await person()];

      const res = await api()
        .post('/categories')
        .set(me.auth)
        .send({
          name: 'Sport',
          userId: other.id,
          cycleType: 'DAILY',
          isDeletable: false,
          isTemplate: true,
          createdAt: LONG_AGO,
        })
        .expect(201);

      const row = await prisma.category.findUniqueOrThrow({
        where: { id: (res.body as { id: string }).id },
      });
      expect(row).toMatchObject({
        name: 'Sport',
        userId: me.id,
        cycleType: null,
        isDeletable: true,
        isTemplate: false,
      });
      expect(row.createdAt.getTime()).toBeGreaterThan(recently().getTime());
    });
  });

  describe('PATCH /categories/:id', () => {
    it('cannot hand the category to another user or change its kind', async () => {
      const [me, other] = [await person(), await person()];
      const id = await newCategory(me);

      await api()
        .patch(`/categories/${id}`)
        .set(me.auth)
        .send({
          name: 'Bieganie',
          userId: other.id,
          cycleType: 'WEEKLY',
          isDeletable: false,
        })
        .expect(200);

      expect(
        await prisma.category.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        name: 'Bieganie',
        userId: me.id,
        cycleType: null,
        isDeletable: true,
      });
      expect(await prisma.category.count({ where: { userId: other.id } })).toBe(
        0,
      );
    });
  });

  describe('POST /tasks', () => {
    it('ignores a back date, a status and the visibility sent with a new task', async () => {
      const [me, other] = [await person(), await person()];
      const categoryId = await newCategory(me);

      const res = await api()
        .post('/tasks')
        .set(me.auth)
        .send({
          title: 'Basen',
          categoryId,
          userId: other.id,
          createdAt: LONG_AGO,
          status: 'COMPLETED',
          visibility: 'PUBLIC',
        })
        .expect(201);

      const row = await prisma.task.findUniqueOrThrow({
        where: { id: (res.body as { id: string }).id },
      });
      expect(row).toMatchObject({
        title: 'Basen',
        userId: me.id,
        status: 'ACTIVE',
        visibility: 'PRIVATE',
      });
      // A task is not due on the day it is added; a back date would skip that.
      expect(row.createdAt.getTime()).toBeGreaterThan(recently().getTime());
    });
  });

  describe('POST /auth/register', () => {
    it('starts every account at zero, whatever the body says', async () => {
      await api()
        .post('/auth/register')
        .send({
          email: 'new@example.com',
          username: 'panda',
          password: PASSWORD,
          xpTotal: 99999,
          level: 50,
          tutorialStatus: 'COMPLETED',
          friendCode: 'AAAA1111',
        })
        .expect(201);

      expect(
        await prisma.user.findUniqueOrThrow({
          where: { email: 'new@example.com' },
        }),
      ).toMatchObject({ xpTotal: 0, level: 1, tutorialStatus: 'NOT_STARTED' });
      expect(
        (
          await prisma.user.findUniqueOrThrow({
            where: { email: 'new@example.com' },
          })
        ).friendCode,
      ).not.toBe('AAAA1111');
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('writes only the title and the progress, not the owner or the date', async () => {
      const [me, other] = [await person(), await person()];
      const categoryId = await newCategory(me);
      const task = (
        (
          await api()
            .post('/tasks')
            .set(me.auth)
            .send({ title: 'Basen', categoryId })
            .expect(201)
        ).body as { id: string }
      ).id;

      await api()
        .patch(`/tasks/${task}`)
        .set(me.auth)
        .send({ title: 'Basen 2', userId: other.id, createdAt: LONG_AGO })
        .expect(200);

      const row = await prisma.task.findUniqueOrThrow({ where: { id: task } });
      expect(row).toMatchObject({ title: 'Basen 2', userId: me.id });
      expect(row.createdAt.getTime()).toBeGreaterThan(recently().getTime());
    });
  });
});
