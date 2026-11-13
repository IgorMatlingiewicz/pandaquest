import { randomInt as cryptoRandomInt } from 'node:crypto';
import { violatedUniqueIndex } from '../common/prisma-errors';

/*
 * Friend codes: how users find each other, as usernames are not unique.
 * Pure functions, and withFreshFriendCode for writing one: the database keeps
 * codes unique, and a taken code is simply drawn again.
 */

/** 32 characters without the look-alikes O, 0, I and 1. */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const FRIEND_CODE_LENGTH = 8;

/** A whole number from 0 up to, but not including, max. */
export type RandomInt = (max: number) => number;

/**
 * A new code. The default source is node:crypto, not Math.random: a code is
 * what lets a stranger send a request, so it must not be predictable.
 */
export function generateFriendCode(
  randomInt: RandomInt = cryptoRandomInt,
): string {
  return Array.from(
    { length: FRIEND_CODE_LENGTH },
    () => FRIEND_CODE_ALPHABET[randomInt(FRIEND_CODE_ALPHABET.length)],
  ).join('');
}

/** As typed or pasted: any case, with spaces or dashes, e.g. "abcd-efgh". */
export function normalizeFriendCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

const CODE_PATTERN = new RegExp(
  `^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`,
);

/** Whether a normalized value can be a code at all. */
export function isFriendCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/** "ABCDEFGH" as "ABCD-EFGH", for showing only; codes are stored without. */
export function formatFriendCode(code: string): string {
  const half = FRIEND_CODE_LENGTH / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** The unique index on users.friendCode, as the migration names it. */
export const FRIEND_CODE_INDEX = 'users_friendCode_key';

/** Draws before giving up. 32^8 codes make even a second draw rare. */
export const FRIEND_CODE_ATTEMPTS = 5;

/**
 * Runs a write that stores a new friend code, drawing another code when the
 * database says the code is taken. Any other error, a taken email included,
 * goes straight to the caller. The whole write runs again on each attempt:
 * after a unique violation Postgres refuses anything more in that
 * transaction, so a retry inside it would fail too.
 */
export async function withFreshFriendCode<T>(
  write: (code: string) => Promise<T>,
  generate: () => string = generateFriendCode,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write(generate());
    } catch (error) {
      if (violatedUniqueIndex(error) !== FRIEND_CODE_INDEX) throw error;
      if (attempt === FRIEND_CODE_ATTEMPTS) {
        throw new Error(
          `No free friend code after ${FRIEND_CODE_ATTEMPTS} draws`,
          { cause: error },
        );
      }
    }
  }
}
