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

  it('answers 401 without a token', async () => {
    await api().post('/tutorial/dismiss').expect(401);
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
    });
  });
});
