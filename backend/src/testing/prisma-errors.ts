import { Prisma } from '../generated/prisma/client';

/**
 * A unique violation (P2002) shaped as Prisma 7 reports it through the pg
 * adapter: the index name in meta.driverAdapterError, no meta.target. Copied
 * from what test/friendships.e2e-spec.ts sees on a real Postgres.
 */
export function uniqueViolation(index: string) {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the constraint: \`${index}\``,
    {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23505',
            kind: 'UniqueConstraintViolation',
            constraint: { index },
          },
        },
      },
    },
  );
}
