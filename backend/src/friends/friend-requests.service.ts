import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { violatedUniqueIndex } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { isFriendCode, normalizeFriendCode } from './friend-code';
import { friendError } from './friend-errors';
import {
  canAnswer,
  decideRequest,
  isFriendLimitReached,
  isVisibleOutgoing,
  type PairRow,
} from './friend-requests.logic';
import { requestView } from './friend-views';

/** The unique index on the pair, as the migration names it. */
const PAIR_INDEX = 'friendships_pair_key';

/**
 * Tries of one request. A try is redone when another one changed the pair
 * in between; a third clash in a row is not a race any more but a bug.
 */
const SEND_ATTEMPTS = 3;

/** A conditional write found the row changed since it was read. */
class StaleRead extends Error {}

type Db = Prisma.TransactionClient | PrismaService;

const PAIR_FIELDS = {
  id: true,
  requesterId: true,
  addresseeId: true,
  status: true,
  respondedAt: true,
} as const;

const OTHER_FIELDS = { select: { username: true, level: true } } as const;

function findPair(db: Db, a: string, b: string): Promise<PairRow | null> {
  return db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: PAIR_FIELDS,
  });
}

function countFriends(db: Db, userId: string): Promise<number> {
  return db.friendship.count({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

/** Throws StaleRead when a conditional write matched nothing. */
async function changedOne(write: Promise<{ count: number }>): Promise<void> {
  if ((await write).count === 0) throw new StaleRead();
}

export type SendResult = {
  id: string;
  status: 'PENDING' | 'ACCEPTED';
  /** True when the request accepted one the other side had already sent. */
  autoAccepted: boolean;
};

@Injectable()
export class FriendRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sends a request to the owner of a friend code. Every way of missing (a
   * malformed code, an unknown one) is the same 404, so trying codes tells
   * nothing about which exist.
   */
  async send(me: string, rawCode: string): Promise<SendResult> {
    const code = normalizeFriendCode(rawCode);
    const target = isFriendCode(code)
      ? await this.prisma.user.findUnique({
          where: { friendCode: code },
          select: { id: true },
        })
      : null;
    if (!target) throw friendError('INVALID_FRIEND_CODE');

    // Two people may ask each other at the same moment: both read no row,
    // both insert, and the unique index on the pair stops the second. Its
    // try is then redone from a fresh read, finds the first one's request
    // and accepts it, as if they had asked one after the other.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction((tx) =>
          this.sendOnce(tx, me, target.id),
        );
      } catch (error) {
        const race =
          error instanceof StaleRead ||
          violatedUniqueIndex(error) === PAIR_INDEX;
        if (!race || attempt === SEND_ATTEMPTS) throw error;
      }
    }
  }

  private async sendOnce(
    tx: Prisma.TransactionClient,
    me: string,
    them: string,
  ): Promise<SendResult> {
    const now = new Date();
    const [row, myFriends, theirFriends, myPendingOutgoing] = await Promise.all(
      [
        findPair(tx, me, them),
        countFriends(tx, me),
        countFriends(tx, them),
        tx.friendship.count({ where: { requesterId: me, status: 'PENDING' } }),
      ],
    );
    const decision = decideRequest(
      me,
      them,
      row,
      { myFriends, theirFriends, myPendingOutgoing },
      now,
    );

    // Each write below names the state it was decided on (status and who
    // asked), so if the row changed after the read it matches nothing and
    // the whole try is redone instead of writing over somebody's answer.
    switch (decision.kind) {
      case 'refuse':
        throw friendError(decision.code, decision.details);
      case 'create': {
        const { id } = await tx.friendship.create({
          data: { requesterId: me, addresseeId: them },
          select: { id: true },
        });
        return { id, status: 'PENDING', autoAccepted: false };
      }
      case 'accept':
        await changedOne(
          tx.friendship.updateMany({
            where: { id: decision.id, status: 'PENDING', requesterId: them },
            data: { status: 'ACCEPTED', respondedAt: now },
          }),
        );
        return { id: decision.id, status: 'ACCEPTED', autoAccepted: true };
      case 'resend':
        await changedOne(
          tx.friendship.updateMany({
            where: { id: decision.id, status: 'DECLINED', requesterId: me },
            data: { status: 'PENDING', createdAt: now, respondedAt: null },
          }),
        );
        return { id: decision.id, status: 'PENDING', autoAccepted: false };
      case 'reverse':
        await changedOne(
          tx.friendship.updateMany({
            where: { id: decision.id, status: 'DECLINED', requesterId: them },
            data: {
              requesterId: me,
              addresseeId: them,
              status: 'PENDING',
              createdAt: now,
              respondedAt: null,
            },
          }),
        );
        return { id: decision.id, status: 'PENDING', autoAccepted: false };
    }
  }

  /**
   * Requests waiting for the user's answer, and the ones they sent: still
   * waiting, or declined while the sender must wait to ask again.
   */
  async list(me: string) {
    const now = new Date();
    const fields = {
      id: true,
      status: true,
      createdAt: true,
      respondedAt: true,
    };
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { addresseeId: me, status: 'PENDING' },
        select: { ...fields, requester: OTHER_FIELDS },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: me, status: { in: ['PENDING', 'DECLINED'] } },
        select: { ...fields, addressee: OTHER_FIELDS },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      incoming: incoming.map((row) => requestView(row, row.requester)),
      outgoing: outgoing
        .filter((row) => isVisibleOutgoing(row, now))
        .map((row) => requestView(row, row.addressee)),
    };
  }

  /** Accepts a request sent to the user; room for a friend on both sides. */
  async accept(me: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.friendship.findUnique({
        where: { id },
        select: PAIR_FIELDS,
      });
      if (!canAnswer(row, me)) throw friendError('REQUEST_NOT_FOUND');

      const [mine, theirs] = await Promise.all([
        countFriends(tx, me),
        countFriends(tx, row.requesterId),
      ]);
      if (isFriendLimitReached(mine, theirs)) {
        throw friendError('FRIEND_LIMIT_REACHED');
      }

      // Still waiting and still mine to answer, or it was taken back.
      const { count } = await tx.friendship.updateMany({
        where: { id, addresseeId: me, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      if (count === 0) throw friendError('REQUEST_NOT_FOUND');
      return { id, status: 'ACCEPTED' as const };
    });
  }

  /**
   * Declines a request sent to the user. The row stays: its sender may ask
   * again only after the cooldown, counted from now.
   */
  async decline(me: string, id: string) {
    const { count } = await this.prisma.friendship.updateMany({
      where: { id, addresseeId: me, status: 'PENDING' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    if (count === 0) throw friendError('REQUEST_NOT_FOUND');
    return { id, status: 'DECLINED' as const };
  }

  /** Takes back a request the user sent; no trace, so no cooldown either. */
  async cancel(me: string, id: string): Promise<void> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: { id, requesterId: me, status: 'PENDING' },
    });
    if (count === 0) throw friendError('REQUEST_NOT_FOUND');
  }

  /** For the badge in the navigation. */
  async summary(me: string) {
    const [friendsCount, pendingIncomingCount] = await Promise.all([
      countFriends(this.prisma, me),
      this.prisma.friendship.count({
        where: { addresseeId: me, status: 'PENDING' },
      }),
    ]);
    return { friendsCount, pendingIncomingCount };
  }
}
