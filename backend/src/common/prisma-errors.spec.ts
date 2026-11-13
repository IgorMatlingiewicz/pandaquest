import { Prisma } from '../generated/prisma/client';
import { uniqueViolation } from '../testing/prisma-errors';
import { violatedUniqueIndex } from './prisma-errors';

describe('violatedUniqueIndex', () => {
  it('names the index of a unique violation', () => {
    expect(violatedUniqueIndex(uniqueViolation('users_friendCode_key'))).toBe(
      'users_friendCode_key',
    );
  });

  it('is null for a P2002 that names no index', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target: ['friendCode'] },
    });

    expect(violatedUniqueIndex(error)).toBeNull();
  });

  it.each([
    [
      'a CHECK violation (P2039)',
      new Prisma.PrismaClientKnownRequestError('Database error', {
        code: 'P2039',
        clientVersion: '7.10.0',
      }),
    ],
    ['a plain error', new Error('boom')],
    ['not an error at all', 'P2002'],
  ])('is null for %s', (_, error) => {
    expect(violatedUniqueIndex(error)).toBeNull();
  });
});
