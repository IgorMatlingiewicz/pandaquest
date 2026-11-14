import type { FriendshipStatus } from '../generated/prisma/client';
import type { FriendErrorCode } from './friend-errors';
import {
  MAX_FRIENDS,
  MAX_PENDING_OUTGOING,
  RESEND_COOLDOWN_MS,
} from './friends.config';

/*
 * The rules for friend requests, without the database: given what is stored
 * for a pair and the counts that matter, what a request should do. The
 * service reads, asks these functions, and writes what they decide.
 */

/** The stored row of a pair, if any; the same row whichever way round. */
export type PairRow = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  respondedAt: Date | null;
};

export type RequestCounts = {
  /** Friends of the one asking, and of the one asked. */
  myFriends: number;
  theirFriends: number;
  /** Requests the one asking has sent that still wait for an answer. */
  myPendingOutgoing: number;
};

export type Refusal = {
  kind: 'refuse';
  code: FriendErrorCode;
  details?: Record<string, unknown>;
};

export type RequestDecision =
  | Refusal
  // A new pending row, me -> them.
  | { kind: 'create' }
  // They asked me already: my request accepts theirs.
  | { kind: 'accept'; id: string }
  // They declined me and the cooldown is over: the row waits again.
  | { kind: 'resend'; id: string }
  // I declined them before and now ask myself: the row turns round.
  | { kind: 'reverse'; id: string };

const refuse = (
  code: FriendErrorCode,
  details?: Record<string, unknown>,
): Refusal =>
  details ? { kind: 'refuse', code, details } : { kind: 'refuse', code };

/** When the one who was declined may ask again. */
export function resendAvailableAt(respondedAt: Date): Date {
  return new Date(respondedAt.getTime() + RESEND_COOLDOWN_MS);
}

/** Either side at the limit: a friendship needs room on both. */
export function isFriendLimitReached(
  myFriends: number,
  theirFriends: number,
): boolean {
  return myFriends >= MAX_FRIENDS || theirFriends >= MAX_FRIENDS;
}

function friendLimit(counts: RequestCounts): Refusal | null {
  return isFriendLimitReached(counts.myFriends, counts.theirFriends)
    ? refuse('FRIEND_LIMIT_REACHED')
    : null;
}

/** A request that will wait for an answer: room for a friend and a request. */
function newPending(
  counts: RequestCounts,
  decision: RequestDecision,
): RequestDecision {
  return (
    friendLimit(counts) ??
    (counts.myPendingOutgoing >= MAX_PENDING_OUTGOING
      ? refuse('TOO_MANY_PENDING_REQUESTS')
      : decision)
  );
}

/**
 * What a request from `me` to `them` does, given the pair's row (null when
 * they have none) and the counts. Checked in this order: oneself, already
 * friends, already asked, asked by them (accepted at once), declined.
 */
export function decideRequest(
  me: string,
  them: string,
  row: PairRow | null,
  counts: RequestCounts,
  now: Date,
): RequestDecision {
  if (me === them) return refuse('CANNOT_ADD_SELF');
  if (!row) return newPending(counts, { kind: 'create' });

  if (row.status === 'ACCEPTED') return refuse('ALREADY_FRIENDS');

  const iAsked = row.requesterId === me;
  if (row.status === 'PENDING') {
    if (iAsked) return refuse('REQUEST_ALREADY_SENT');
    // Two people asking each other want the same thing.
    return friendLimit(counts) ?? { kind: 'accept', id: row.id };
  }

  // DECLINED. The cooldown binds only the one who was declined; the one who
  // declined may change their mind at any time.
  if (!iAsked) return newPending(counts, { kind: 'reverse', id: row.id });
  const availableAt = resendAvailableAt(row.respondedAt ?? now);
  if (now < availableAt) {
    return refuse('FRIEND_REQUEST_COOLDOWN', {
      availableAt: availableAt.toISOString(),
    });
  }
  return newPending(counts, { kind: 'resend', id: row.id });
}

/**
 * Whether `me` may answer a request: only its addressee, only while it waits.
 * Anything else looks like no request at all, so nobody learns of others'.
 */
export function canAnswer(row: PairRow | null, me: string): row is PairRow {
  return row !== null && row.addresseeId === me && row.status === 'PENDING';
}

/**
 * Whether a sent request still shows in the sender's list: while it waits,
 * and after a decline until the sender may ask again, so they can see when.
 */
export function isVisibleOutgoing(
  row: Pick<PairRow, 'status' | 'respondedAt'>,
  now: Date,
): boolean {
  if (row.status === 'PENDING') return true;
  return (
    row.status === 'DECLINED' &&
    row.respondedAt !== null &&
    now < resendAvailableAt(row.respondedAt)
  );
}
