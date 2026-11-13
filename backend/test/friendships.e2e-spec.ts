import { Prisma } from '../src/generated/prisma/client';
import { violatedUniqueIndex } from '../src/common/prisma-errors';
import { PrismaService } from '../src/prisma/prisma.service';
import { createUser, resetDatabase } from './db';

/*
 * What the database itself refuses, on a real Postgres with every migration
 * applied, the hand-written SQL included; the fake database in the unit tests
 * only imitates these rules. It also pins down how Prisma 7 reports each
 * refusal through the pg adapter, which the services rely on.
 */
describe('friendships in the database', () => {
  const prisma = new PrismaService();

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(() => resetDatabase(prisma));

  const request = (requesterId: string, addresseeId: string) =>
    prisma.friendship.create({ data: { requesterId, addresseeId } });

  async function refusal(write: () => Promise<unknown>): Promise<unknown> {
    try {
      await write();
    } catch (error: unknown) {
      return error;
    }
    throw new Error('the write was accepted');
  }

  it('keeps a request as sent, pending, with no answer yet', async () => {
    const [a, b] = [await createUser(prisma), await createUser(prisma)];

    const row = await request(a.id, b.id);

    expect(row).toMatchObject({
      requesterId: a.id,
      addresseeId: b.id,
      status: 'PENDING',
      respondedAt: null,
    });
  });

  describe('one row per pair, whichever way round', () => {
    it.each([
      ['the same way again', 'a', 'b'],
      ['the other way round', 'b', 'a'],
    ] as const)('refuses a second request %s', async (_, from, to) => {
      const users = {
        a: await createUser(prisma),
        b: await createUser(prisma),
      };
      await request(users.a.id, users.b.id);

      const error = await refusal(() => request(users[from].id, users[to].id));

      // P2002 with the index name, and no meta.target: through the pg adapter
      // Prisma reports the index in meta.driverAdapterError instead.
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error).toMatchObject({ code: 'P2002' });
      expect((error as { meta: object }).meta).not.toHaveProperty('target');
      expect(violatedUniqueIndex(error)).toBe('friendships_pair_key');
    });

    it('still lets each of them pair with somebody else', async () => {
      const [a, b, c] = [
        await createUser(prisma),
        await createUser(prisma),
        await createUser(prisma),
      ];
      await request(a.id, b.id);

      await request(c.id, a.id);
      await request(b.id, c.id);

      expect(await prisma.friendship.count()).toBe(3);
    });
  });

  it('refuses a request to oneself through the CHECK, as P2039', async () => {
    const a = await createUser(prisma);

    const error = await refusal(() => request(a.id, a.id));

    // Not P2002 and not P2004: Prisma has no code of its own for a CHECK and
    // passes the Postgres one (23514) on.
    expect(error).toMatchObject({
      code: 'P2039',
      meta: { driverAdapterError: { cause: { originalCode: '23514' } } },
    });
  });

  it('refuses a friend code another user has', async () => {
    const a = await createUser(prisma);

    const error = await refusal(() =>
      createUser(prisma, { friendCode: a.friendCode }),
    );

    expect(violatedUniqueIndex(error)).toBe('users_friendCode_key');
  });

  it('refuses a user without a friend code', async () => {
    const error = await refusal(
      () =>
        prisma.$executeRaw`
        INSERT INTO users (id, email, username, "passwordHash", "updatedAt")
        VALUES (gen_random_uuid(), 'nocode@example.com', 'x', 'x', now())`,
    );

    expect(error).toBeDefined();
    expect(await prisma.user.count()).toBe(0);
  });

  it('removes a deleted user’s requests, sent and received', async () => {
    const [a, b, c] = [
      await createUser(prisma),
      await createUser(prisma),
      await createUser(prisma),
    ];
    await request(a.id, b.id);
    await request(c.id, a.id);
    await request(b.id, c.id);

    await prisma.user.delete({ where: { id: a.id } });

    const left = await prisma.friendship.findMany();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ requesterId: b.id, addresseeId: c.id });
  });
});
