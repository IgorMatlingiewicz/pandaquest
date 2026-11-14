import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** The whole API, set up as main.ts sets it up, on the test database. */
export async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export const PASSWORD = 'haslo1234';

/** Signs up over HTTP, as the app does. */
export function signUp(
  app: INestApplication<App>,
  email: string,
  username = 'panda',
) {
  return request(app.getHttpServer()).post('/auth/register').send({
    email,
    username,
    password: PASSWORD,
    timezone: 'Europe/Warsaw',
  });
}

/** A signed-up, logged-in account: its id and a Bearer header to send. */
export async function account(
  app: INestApplication<App>,
  email: string,
  username = 'panda',
) {
  await signUp(app, email, username).expect(201);
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(201);
  const { accessToken } = login.body as { accessToken: string };
  const auth = { Authorization: `Bearer ${accessToken}` };
  const me = await request(app.getHttpServer())
    .get('/auth/me')
    .set(auth)
    .expect(200);
  return { id: (me.body as { id: string }).id, auth };
}
