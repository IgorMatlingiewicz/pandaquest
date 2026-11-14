import {
  FRIEND_REQUEST_RATE,
  MAX_FRIENDS,
  MAX_PENDING_OUTGOING,
  RESEND_COOLDOWN_MS,
} from './friends.config';

// The rules as agreed, pinned: every other test counts from these constants,
// so without this one a changed value would pass unnoticed.
describe('friends config', () => {
  it('makes a declined sender wait 7 whole days', () => {
    expect(RESEND_COOLDOWN_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('allows 20 waiting requests and 100 friends', () => {
    expect(MAX_PENDING_OUTGOING).toBe(20);
    expect(MAX_FRIENDS).toBe(100);
  });

  it('lets one user send 10 requests a minute', () => {
    expect(FRIEND_REQUEST_RATE).toEqual({ limit: 10, ttl: 60_000 });
  });
});
