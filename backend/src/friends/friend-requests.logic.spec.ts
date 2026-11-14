import {
  MAX_FRIENDS,
  MAX_PENDING_OUTGOING,
  RESEND_COOLDOWN_MS,
} from './friends.config';
import {
  canAnswer,
  decideRequest,
  isFriendLimitReached,
  isVisibleOutgoing,
  resendAvailableAt,
  type PairRow,
  type RequestCounts,
} from './friend-requests.logic';

const ME = 'me';
const THEM = 'them';
const NOW = new Date('2026-11-14T12:00:00.000Z');
const COUNTS: RequestCounts = {
  myFriends: 0,
  theirFriends: 0,
  myPendingOutgoing: 0,
};

const row = (fields: Partial<PairRow>): PairRow => ({
  id: 'row-1',
  requesterId: ME,
  addresseeId: THEM,
  status: 'PENDING',
  respondedAt: null,
  ...fields,
});
const declined = (requesterId: string, respondedAt: Date) =>
  row({
    requesterId,
    addresseeId: requesterId === ME ? THEM : ME,
    status: 'DECLINED',
    respondedAt,
  });
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('decideRequest', () => {
  it('refuses a request to oneself', () => {
    expect(decideRequest(ME, ME, null, COUNTS, NOW)).toEqual({
      kind: 'refuse',
      code: 'CANNOT_ADD_SELF',
    });
  });

  it('creates a pending request when the pair has no row', () => {
    expect(decideRequest(ME, THEM, null, COUNTS, NOW)).toEqual({
      kind: 'create',
    });
  });

  it('refuses friends already friends, whoever asked back then', () => {
    for (const requesterId of [ME, THEM]) {
      const accepted = row({
        requesterId,
        addresseeId: requesterId === ME ? THEM : ME,
        status: 'ACCEPTED',
        respondedAt: ago(1000),
      });

      expect(decideRequest(ME, THEM, accepted, COUNTS, NOW)).toEqual({
        kind: 'refuse',
        code: 'ALREADY_FRIENDS',
      });
    }
  });

  it('refuses a second request the same way while the first waits', () => {
    expect(decideRequest(ME, THEM, row({}), COUNTS, NOW)).toEqual({
      kind: 'refuse',
      code: 'REQUEST_ALREADY_SENT',
    });
  });

  it('accepts their waiting request when I ask them too', () => {
    const theirs = row({ id: 'theirs', requesterId: THEM, addresseeId: ME });

    expect(decideRequest(ME, THEM, theirs, COUNTS, NOW)).toEqual({
      kind: 'accept',
      id: 'theirs',
    });
  });

  it('accepts theirs even with my outgoing list full: nothing new waits', () => {
    const theirs = row({ requesterId: THEM, addresseeId: ME });
    const full = { ...COUNTS, myPendingOutgoing: MAX_PENDING_OUTGOING };

    expect(decideRequest(ME, THEM, theirs, full, NOW)).toMatchObject({
      kind: 'accept',
    });
  });

  describe('after they declined me', () => {
    it('refuses until 7 days after the decline, saying when', () => {
      const respondedAt = ago(RESEND_COOLDOWN_MS - 1);

      expect(
        decideRequest(ME, THEM, declined(ME, respondedAt), COUNTS, NOW),
      ).toEqual({
        kind: 'refuse',
        code: 'FRIEND_REQUEST_COOLDOWN',
        details: {
          availableAt: new Date(
            respondedAt.getTime() + RESEND_COOLDOWN_MS,
          ).toISOString(),
        },
      });
    });

    it('lets me ask again at exactly 7 days, on the same row', () => {
      const exactly = declined(ME, ago(RESEND_COOLDOWN_MS));

      expect(decideRequest(ME, THEM, exactly, COUNTS, NOW)).toEqual({
        kind: 'resend',
        id: 'row-1',
      });
    });

    it('counts the 7 days from the decline, not from the request', () => {
      expect(
        decideRequest(ME, THEM, declined(ME, ago(60_000)), COUNTS, NOW),
      ).toMatchObject({ code: 'FRIEND_REQUEST_COOLDOWN' });
    });

    it('waits the full cooldown if a decline somehow has no answer time', () => {
      const noTime = row({ status: 'DECLINED', respondedAt: null });

      expect(decideRequest(ME, THEM, noTime, COUNTS, NOW)).toMatchObject({
        code: 'FRIEND_REQUEST_COOLDOWN',
        details: { availableAt: resendAvailableAt(NOW).toISOString() },
      });
    });
  });

  describe('after I declined them', () => {
    it('lets me ask them at once, turning the row round', () => {
      const mine = declined(THEM, ago(60_000));

      expect(decideRequest(ME, THEM, mine, COUNTS, NOW)).toEqual({
        kind: 'reverse',
        id: 'row-1',
      });
    });
  });

  describe('limits', () => {
    const pendingFull = { ...COUNTS, myPendingOutgoing: MAX_PENDING_OUTGOING };
    const almost = { ...COUNTS, myPendingOutgoing: MAX_PENDING_OUTGOING - 1 };

    it(`refuses a ${MAX_PENDING_OUTGOING + 1}st waiting request`, () => {
      expect(decideRequest(ME, THEM, null, pendingFull, NOW)).toEqual({
        kind: 'refuse',
        code: 'TOO_MANY_PENDING_REQUESTS',
      });
      expect(decideRequest(ME, THEM, null, almost, NOW)).toEqual({
        kind: 'create',
      });
    });

    it.each([
      ['a resend', declined(ME, ago(RESEND_COOLDOWN_MS))],
      ['a reversed request', declined(THEM, ago(1000))],
    ])('counts %s as one more waiting request', (_, pair) => {
      expect(decideRequest(ME, THEM, pair, pendingFull, NOW)).toMatchObject({
        code: 'TOO_MANY_PENDING_REQUESTS',
      });
    });

    it.each([
      ['mine', { ...COUNTS, myFriends: MAX_FRIENDS }],
      ['theirs', { ...COUNTS, theirFriends: MAX_FRIENDS }],
    ])('refuses when the friend list is full: %s', (_, counts) => {
      const theirs = row({ requesterId: THEM, addresseeId: ME });

      for (const pair of [null, theirs, declined(THEM, ago(1000))]) {
        expect(decideRequest(ME, THEM, pair, counts, NOW)).toEqual({
          kind: 'refuse',
          code: 'FRIEND_LIMIT_REACHED',
        });
      }
    });

    it(`allows the ${MAX_FRIENDS}th friend`, () => {
      const counts = {
        ...COUNTS,
        myFriends: MAX_FRIENDS - 1,
        theirFriends: MAX_FRIENDS - 1,
      };

      expect(decideRequest(ME, THEM, null, counts, NOW)).toEqual({
        kind: 'create',
      });
    });

    it('names the friend limit before the request limit', () => {
      const both = {
        myFriends: MAX_FRIENDS,
        theirFriends: 0,
        myPendingOutgoing: MAX_PENDING_OUTGOING,
      };

      expect(decideRequest(ME, THEM, null, both, NOW)).toMatchObject({
        code: 'FRIEND_LIMIT_REACHED',
      });
    });
  });
});

describe('canAnswer', () => {
  const incoming = row({ requesterId: THEM, addresseeId: ME });

  it('lets only the addressee answer, only while it waits', () => {
    expect(canAnswer(incoming, ME)).toBe(true);
    expect(canAnswer(incoming, THEM)).toBe(false);
    expect(canAnswer(incoming, 'stranger')).toBe(false);
    expect(canAnswer({ ...incoming, status: 'ACCEPTED' }, ME)).toBe(false);
    expect(canAnswer({ ...incoming, status: 'DECLINED' }, ME)).toBe(false);
    expect(canAnswer(null, ME)).toBe(false);
  });
});

describe('isFriendLimitReached', () => {
  it('is reached when either side has the maximum', () => {
    expect(isFriendLimitReached(MAX_FRIENDS, 0)).toBe(true);
    expect(isFriendLimitReached(0, MAX_FRIENDS)).toBe(true);
    expect(isFriendLimitReached(MAX_FRIENDS - 1, MAX_FRIENDS - 1)).toBe(false);
  });
});

describe('isVisibleOutgoing', () => {
  it('shows a waiting request', () => {
    expect(
      isVisibleOutgoing({ status: 'PENDING', respondedAt: null }, NOW),
    ).toBe(true);
  });

  it('shows a declined one until the sender may ask again', () => {
    const shown = {
      status: 'DECLINED' as const,
      respondedAt: ago(RESEND_COOLDOWN_MS - 1),
    };
    const gone = {
      status: 'DECLINED' as const,
      respondedAt: ago(RESEND_COOLDOWN_MS),
    };

    expect(isVisibleOutgoing(shown, NOW)).toBe(true);
    expect(isVisibleOutgoing(gone, NOW)).toBe(false);
  });

  it('does not show friendships or a decline without a time', () => {
    expect(
      isVisibleOutgoing({ status: 'ACCEPTED', respondedAt: ago(1000) }, NOW),
    ).toBe(false);
    expect(
      isVisibleOutgoing({ status: 'DECLINED', respondedAt: null }, NOW),
    ).toBe(false);
  });
});
