import type { Prisma } from '../generated/prisma/client';
import { levelForXp } from './xp.logic';

/**
 * Adds XP to the user's total and raises the stored level when a threshold
 * was crossed. The one place where XP turns into a level, for tasks and
 * badges alike. The increment runs in the database, so concurrent awards
 * add up instead of overwriting each other.
 */
export async function addXp(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
): Promise<{ level: number; leveledUp: boolean }> {
  const user = await tx.user.update({
    where: { id: userId },
    data: { xpTotal: { increment: amount } },
  });
  const level = levelForXp(user.xpTotal);
  const leveledUp = level > user.level;
  if (leveledUp) {
    await tx.user.update({ where: { id: userId }, data: { level } });
  }
  return { level, leveledUp };
}
