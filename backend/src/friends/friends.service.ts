import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { withFreshFriendCode } from './friend-code';
import { friendError } from './friend-errors';
import {
  friendBadgesView,
  friendProfileView,
  friendView,
  type FriendBadgeView,
  type FriendProfileView,
  type FriendView,
} from './friend-views';

/** Prisma's code for "the record to update does not exist". */
const RECORD_NOT_FOUND = 'P2025';

/** A friendship of `userId`, whichever side asked. */
const friendshipOf = (userId: string, friendshipId: string) => ({
  id: friendshipId,
  status: 'ACCEPTED' as const,
  OR: [{ requesterId: userId }, { addresseeId: userId }],
});

const PERSON = { select: { username: true, level: true } } as const;

// Polish names sort as Polish readers expect: "Łukasz" after "Lena".
const byName = new Intl.Collator('pl', { sensitivity: 'base' });

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
  ) {}

  /** The user's friends by name; each one addressed by the friendship's id. */
  async list(me: string): Promise<FriendView[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: me }, { addresseeId: me }],
      },
      select: {
        id: true,
        requesterId: true,
        requester: PERSON,
        addressee: PERSON,
      },
    });
    return rows
      .map((row) =>
        friendView(
          row.id,
          row.requesterId === me ? row.addressee : row.requester,
        ),
      )
      .sort(
        (a, b) =>
          byName.compare(a.username, b.username) ||
          a.friendshipId.localeCompare(b.friendshipId),
      );
  }

  /**
   * The other side of one of the user's friendships. The id in the path is
   * never trusted alone: the row must be accepted and have the user on one
   * of its sides. Anything else, a pending request or somebody else's
   * friendship included, is the same 404 as an id that does not exist.
   */
  private async friendOf(me: string, friendshipId: string): Promise<string> {
    const row = await this.prisma.friendship.findFirst({
      where: friendshipOf(me, friendshipId),
      select: { requesterId: true, addresseeId: true },
    });
    if (!row) throw friendError('FRIEND_NOT_FOUND');
    return row.requesterId === me ? row.addresseeId : row.requesterId;
  }

  /** What a friend may see of another: from the own-profile data, cut down. */
  async profile(me: string, friendshipId: string): Promise<FriendProfileView> {
    const friendId = await this.friendOf(me, friendshipId);
    return friendProfileView(await this.profiles.getProfile(friendId));
  }

  /** The badges a friend earned; read from stored badges only, no metrics. */
  async badges(me: string, friendshipId: string): Promise<FriendBadgeView[]> {
    const friendId = await this.friendOf(me, friendshipId);
    const earned = await this.prisma.userBadge.findMany({
      where: { userId: friendId },
      select: { badgeKey: true, tier: true, earnedAt: true },
    });
    return friendBadgesView(earned);
  }

  /**
   * Ends a friendship, from either side. The row goes for good, so either of
   * them may ask again at once: unlike a decline, there is no cooldown.
   */
  async remove(me: string, friendshipId: string): Promise<void> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: friendshipOf(me, friendshipId),
    });
    if (count === 0) throw friendError('FRIEND_NOT_FOUND');
  }

  /**
   * The user's own code, stored normalized ("ABCDEFGH"); showing it as
   * "ABCD-EFGH" is the app's job. 401 for a token whose account is gone,
   * as /auth/me answers: the JWT guard checks the token, not the account.
   */
  async getCode(userId: string): Promise<{ code: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { friendCode: true },
    });
    if (!user) throw new UnauthorizedException();
    return { code: user.friendCode };
  }

  /**
   * A new code in place of the old one, which stops working at once: it is
   * the same column, overwritten. Friendships stay as they are, as they
   * point at users, not at codes.
   */
  async regenerateCode(userId: string): Promise<{ code: string }> {
    try {
      const { friendCode } = await withFreshFriendCode((code) =>
        this.prisma.user.update({
          where: { id: userId },
          data: { friendCode: code },
          select: { friendCode: true },
        }),
      );
      return { code: friendCode };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        throw new UnauthorizedException();
      }
      throw error;
    }
  }
}
