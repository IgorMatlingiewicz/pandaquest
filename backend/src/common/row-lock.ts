import type { Prisma } from '../generated/prisma/client';

/**
 * Locks the user's row until the transaction ends, so the user's own
 * requests that change the same state run one after another, never side
 * by side. Must be the transaction's first statement: a request that has
 * to wait starts only after the other one committed, and then reads what
 * that one wrote.
 *
 * Why it is needed (found by the race tests on a real Postgres, both on
 * READ COMMITTED, Postgres's default):
 * - the same task completed twice at once: both found no completion row
 *   and both inserted one; the second hit the unique index and answered 500;
 * - the last two daily tasks completed at once: each saw only its own,
 *   uncommitted completion, so both judged the day not full and the full
 *   day was never recorded (write skew).
 *
 * Only this user's requests wait for each other, and only for the few
 * milliseconds of a completion; other users are never held up.
 */
export async function lockUserRow(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}
