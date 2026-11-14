import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

// getTracker is protected; this opens it for the test and nothing else.
class Probe extends UserThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('UserThrottlerGuard', () => {
  const guard = new Probe([], {} as ThrottlerStorage, new Reflector());

  it('counts the account from the token, not the IP address', async () => {
    await expect(
      guard.track({ ip: '10.0.0.1', user: { userId: 'user-1' } }),
    ).resolves.toBe('user-1');
  });

  it('keeps two accounts apart though they share one IP address', async () => {
    const [a, b] = await Promise.all([
      guard.track({ ip: '10.0.0.1', user: { userId: 'user-1' } }),
      guard.track({ ip: '10.0.0.1', user: { userId: 'user-2' } }),
    ]);

    expect(a).not.toBe(b);
  });

  it.each([
    ['no user', { ip: '10.0.0.1' }],
    ['a user without an id', { ip: '10.0.0.1', user: {} }],
  ])(
    'refuses to count by IP when there is %s: the JWT guard did not run first',
    async (_, req) => {
      await expect(guard.track(req)).rejects.toThrow(
        'UserThrottlerGuard needs JwtAuthGuard to run first',
      );
    },
  );
});
