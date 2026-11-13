import { randomUUID } from 'node:crypto';
import { generateFriendCode } from '../src/friends/friend-code';
import type { PrismaService } from '../src/prisma/prisma.service';
import { TEST_DATABASE } from './test-database';

/**
 * Empties every table, so each test starts from nothing. Refuses to run on
 * any database but the test one: a wrong DATABASE_URL must not wipe dev data.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const [{ name }] = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  if (name !== TEST_DATABASE) {
    throw new Error(`Refusing to empty "${name}": not the test database`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

/** A user row with only what the schema requires; tests add what they need. */
export function createUser(
  prisma: PrismaService,
  data: { username?: string; friendCode?: string } = {},
) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      email: `${id}@example.com`,
      username: data.username ?? 'panda',
      passwordHash: 'not-a-real-hash',
      friendCode: data.friendCode ?? generateFriendCode(),
    },
  });
}
