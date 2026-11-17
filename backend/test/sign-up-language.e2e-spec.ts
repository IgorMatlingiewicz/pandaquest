import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { PASSWORD, createApp } from './app';
import { resetDatabase } from './db';

/*
 * The example categories and tasks a new account gets, in the language the
 * app signs up in. Over HTTP on a real Postgres: what is stored is what the
 * Tasks screen will show.
 */
describe('sign-up language', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const signUp = (email: string, language?: unknown) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'panda',
        password: PASSWORD,
        timezone: 'Europe/Warsaw',
        ...(language === undefined ? {} : { language }),
      });

  /** The account's categories and task titles, in their order. */
  async function examplesOf(email: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
      select: {
        name: true,
        tasks: { orderBy: { order: 'asc' }, select: { title: true } },
      },
    });
    return categories.map((c) => ({
      name: c.name,
      tasks: c.tasks.map((t) => t.title),
    }));
  }

  it('writes them in English for an app in English', async () => {
    await signUp('en@example.com', 'en').expect(201);

    expect(await examplesOf('en@example.com')).toEqual([
      { name: 'Daily', tasks: ['Walk the dog', 'Take your pills'] },
      {
        name: 'Weekly',
        tasks: ['Do the laundry', 'Do the shopping', 'Go to the gym'],
      },
      {
        name: 'Life',
        tasks: ['Buy a house', 'Save 100,000', 'Learn to play the violin'],
      },
    ]);
  });

  it('writes them in Polish for an app in Polish', async () => {
    await signUp('pl@example.com', 'pl').expect(201);

    const examples = await examplesOf('pl@example.com');
    expect(examples.map((c) => c.name)).toEqual([
      'Dzienne',
      'Tygodniowe',
      'Życiowe',
    ]);
    expect(examples[0].tasks).toEqual(['Wyprowadź psa', 'Weź tabletki']);
  });

  it('writes them in Polish when the app names no language, as before', async () => {
    await signUp('old@example.com').expect(201);

    expect((await examplesOf('old@example.com'))[0].name).toBe('Dzienne');
  });

  it('refuses a language the app does not have, and creates no account', async () => {
    await signUp('de@example.com', 'de').expect(400);

    expect(
      await prisma.user.count({ where: { email: 'de@example.com' } }),
    ).toBe(0);
  });
});
