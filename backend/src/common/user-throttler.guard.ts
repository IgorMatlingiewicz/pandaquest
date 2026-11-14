import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * A rate limit counted per account, not per IP address. Everyone behind
 * one IP (a dorm, a mobile network's NAT) would otherwise share a single
 * limit, while one person could get round it by switching networks.
 *
 * It reads the user that JwtAuthGuard put on the request, so it must run
 * after that guard. Nest runs a class's guards before a method's, so put
 * JwtAuthGuard on the controller and this one on the route. Without a user
 * it throws, a 500, rather than fall back to the IP: a quiet fallback would
 * hide guards in the wrong order and limit strangers together.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { userId?: unknown } | undefined;
    if (typeof user?.userId !== 'string') {
      return Promise.reject(
        new Error('UserThrottlerGuard needs JwtAuthGuard to run first'),
      );
    }
    return Promise.resolve(user.userId);
  }
}
