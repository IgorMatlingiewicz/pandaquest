import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { isFriendCode, withFreshFriendCode } from '../src/friends/friend-code';
import { PrismaService } from '../src/prisma/prisma.service';
import { createUser, resetDatabase } from './db';

/*
 * Friend codes on a real Postgres: given at sign-up over HTTP, and drawn
 * again when the database says a code is taken.
 */
describe('friend codes', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // As in main.ts, so requests are checked the same way.
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const signUp = (email: string) =>
    request(app.getHttpServer()).post('/auth/register').send({
      email,
      username: 'panda',
      password: 'haslo1234',
      timezone: 'Europe/Warsaw',
    });

  it('gives every new account its own valid code', async () => {
    for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
      expect((await signUp(email)).status).toBe(201);
    }

    const codes = (await prisma.user.findMany()).map((u) => u.friendCode);
    expect(codes).toHaveLength(3);
    expect(codes.every(isFriendCode)).toBe(true);
    expect(new Set(codes).size).toBe(3);
  });

  it('does not show the code in the sign-up answer', async () => {
    const response = await signUp('a@example.com');

    expect(response.body as object).not.toHaveProperty('friendCode');
  });

  it('still answers 409 for an email already taken', async () => {
    await signUp('a@example.com');

    expect((await signUp('a@example.com')).status).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });

  it('draws again when the code is taken in the real database', async () => {
    const owner = await createUser(prisma);
    const draws = [owner.friendCode, owner.friendCode, 'FREE2345'];

    const created = await withFreshFriendCode(
      (friendCode) => createUser(prisma, { friendCode }),
      () => draws.shift()!,
    );

    expect(created.friendCode).toBe('FREE2345');
    expect(draws).toEqual([]);
    expect(await prisma.user.count()).toBe(2);
  });
});
