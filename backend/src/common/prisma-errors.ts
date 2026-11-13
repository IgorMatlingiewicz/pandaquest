import { Prisma } from '../generated/prisma/client';

type AdapterMeta = {
  driverAdapterError?: { cause?: { constraint?: { index?: unknown } } };
};

/**
 * The name of the unique index a write broke (P2002), or null for any other
 * error. Through the pg driver adapter, Prisma 7 puts it in
 * meta.driverAdapterError, not in meta.target, which it leaves out (checked
 * on Postgres in test/friendships.e2e-spec.ts). An index name also works for
 * indexes on expressions, which have no plain columns to list.
 */
export function violatedUniqueIndex(error: unknown): string | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return null;
  }
  const index = (error.meta as AdapterMeta | undefined)?.driverAdapterError
    ?.cause?.constraint?.index;
  return typeof index === 'string' ? index : null;
}
