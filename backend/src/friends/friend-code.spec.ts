import { randomInt } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uniqueViolation } from '../testing/prisma-errors';
import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_ATTEMPTS,
  FRIEND_CODE_INDEX,
  FRIEND_CODE_LENGTH,
  formatFriendCode,
  generateFriendCode,
  isFriendCode,
  normalizeFriendCode,
  withFreshFriendCode,
} from './friend-code';

// The real randomInt, watched: a code must come from node:crypto, not from
// something predictable like Math.random, and only a spy can tell them apart.
jest.mock('node:crypto', () => {
  const actual =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return { ...actual, randomInt: jest.fn(actual.randomInt) };
});

describe('friend code', () => {
  describe('FRIEND_CODE_ALPHABET', () => {
    it('has 32 different characters, none of them easy to mistake', () => {
      expect(new Set(FRIEND_CODE_ALPHABET).size).toBe(32);
      expect(FRIEND_CODE_ALPHABET).toHaveLength(32);
      for (const lookAlike of ['O', '0', 'I', '1']) {
        expect(FRIEND_CODE_ALPHABET).not.toContain(lookAlike);
      }
    });
  });

  describe('generateFriendCode', () => {
    it('draws 8 characters of the alphabet from the source it is given', () => {
      const draws: number[] = [];
      const code = generateFriendCode((max) => {
        draws.push(max);
        return draws.length - 1;
      });

      expect(code).toBe('ABCDEFGH');
      expect(draws).toEqual(Array(FRIEND_CODE_LENGTH).fill(32));
    });

    it('reaches both ends of the alphabet', () => {
      expect(generateFriendCode(() => 0)).toBe('AAAAAAAA');
      expect(generateFriendCode(() => 31)).toBe('99999999');
    });

    it('gives valid codes from the real source, and not the same one twice', () => {
      const codes = Array.from({ length: 200 }, () => generateFriendCode());

      expect(codes.every(isFriendCode)).toBe(true);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('draws from node:crypto by default', () => {
      jest.mocked(randomInt).mockClear();

      generateFriendCode();

      expect(randomInt).toHaveBeenCalledTimes(FRIEND_CODE_LENGTH);
      expect(randomInt).toHaveBeenCalledWith(32);
    });
  });

  describe('normalizeFriendCode', () => {
    it.each([
      ['abcd-efgh', 'ABCDEFGH'],
      [' ABCD EFGH ', 'ABCDEFGH'],
      ['ab-cd-ef-gh', 'ABCDEFGH'],
      ['ABCDEFGH', 'ABCDEFGH'],
      ['abcd\tefgh\n', 'ABCDEFGH'],
    ])('turns %j into %s', (input, expected) => {
      expect(normalizeFriendCode(input)).toBe(expected);
    });

    it('keeps what is not a code as it is, for the lookup to miss', () => {
      expect(normalizeFriendCode('o0i1-xyz')).toBe('O0I1XYZ');
    });
  });

  describe('isFriendCode', () => {
    it('accepts 8 characters of the alphabet', () => {
      expect(isFriendCode('ABCD2345')).toBe(true);
    });

    it.each([
      ['too short', 'ABCD234'],
      ['too long', 'ABCD23456'],
      ['a look-alike', 'ABCD234O'],
      ['lower case', 'abcd2345'],
      ['a dash', 'ABCD-234'],
      ['empty', ''],
    ])('refuses %s', (_, value) => {
      expect(isFriendCode(value)).toBe(false);
    });
  });

  describe('formatFriendCode', () => {
    it('splits the code in two halves for reading', () => {
      expect(formatFriendCode('ABCDEFGH')).toBe('ABCD-EFGH');
    });

    it('is undone by normalizeFriendCode', () => {
      expect(normalizeFriendCode(formatFriendCode('XY23ZW45'))).toBe(
        'XY23ZW45',
      );
    });
  });

  describe('FRIEND_CODE_INDEX', () => {
    it('is the name the migrations give the unique index on friendCode', () => {
      const migrations = join(__dirname, '../../prisma/migrations');
      const sql = readdirSync(migrations)
        .filter((name) => /^\d/.test(name))
        .map((name) =>
          readFileSync(join(migrations, name, 'migration.sql'), 'utf8'),
        )
        .join('\n');

      expect(sql).toContain(
        `CREATE UNIQUE INDEX "${FRIEND_CODE_INDEX}" ON "users"("friendCode")`,
      );
    });
  });

  describe('withFreshFriendCode', () => {
    // Codes handed out in order, so each attempt's code can be checked.
    const codes = () => {
      let n = 0;
      return () => `CODE000${++n}`;
    };

    it('stores the first code when it is free', async () => {
      const write = jest.fn((code: string) => Promise.resolve(code));

      await expect(withFreshFriendCode(write, codes())).resolves.toBe(
        'CODE0001',
      );
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('draws a new code each time the last one was taken', async () => {
      const write = jest
        .fn<Promise<string>, [string]>()
        .mockRejectedValueOnce(uniqueViolation(FRIEND_CODE_INDEX))
        .mockRejectedValueOnce(uniqueViolation(FRIEND_CODE_INDEX))
        .mockImplementation((code) => Promise.resolve(code));

      await expect(withFreshFriendCode(write, codes())).resolves.toBe(
        'CODE0003',
      );
      expect(write.mock.calls.map(([code]) => code)).toEqual([
        'CODE0001',
        'CODE0002',
        'CODE0003',
      ]);
    });

    it(`gives up after ${FRIEND_CODE_ATTEMPTS} taken codes, keeping the last refusal`, async () => {
      const last = uniqueViolation(FRIEND_CODE_INDEX);
      const write = jest
        .fn<Promise<string>, [string]>()
        .mockRejectedValue(uniqueViolation(FRIEND_CODE_INDEX))
        .mockRejectedValueOnce(uniqueViolation(FRIEND_CODE_INDEX))
        .mockRejectedValueOnce(uniqueViolation(FRIEND_CODE_INDEX))
        .mockRejectedValueOnce(uniqueViolation(FRIEND_CODE_INDEX))
        .mockRejectedValueOnce(uniqueViolation(FRIEND_CODE_INDEX))
        .mockRejectedValueOnce(last);

      const error = await withFreshFriendCode(write, codes()).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        `No free friend code after ${FRIEND_CODE_ATTEMPTS} draws`,
      );
      // For the logs: what the database said the last time.
      expect((error as Error).cause).toBe(last);
      expect(write).toHaveBeenCalledTimes(FRIEND_CODE_ATTEMPTS);
    });

    it.each([
      ['a taken email', uniqueViolation('users_email_key')],
      ['any other error', new Error('database down')],
    ])('passes %s on without drawing again', async (_, error) => {
      const write = jest.fn(() => Promise.reject(error));

      await expect(withFreshFriendCode(write, codes())).rejects.toBe(error);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('draws from node:crypto when no source is given', async () => {
      const write = jest.fn((code: string) => Promise.resolve(code));

      await expect(withFreshFriendCode(write)).resolves.toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,
      );
    });
  });
});
