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

/**
 * Deletes an account made by sign-up. Its tasks and categories go first: their
 * foreign keys to users have no ON DELETE CASCADE, so Postgres refuses to
 * delete a user who still has them. Everything else (friendships, badges,
 * XP events, streak goals) cascades. Deleting accounts is not a feature yet;
 * this is how a test makes a token's account disappear.
 */
export async function deleteAccount(prisma: PrismaService, userId: string) {
  await prisma.$transaction([
    prisma.task.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
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
