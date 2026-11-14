import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withFreshFriendCode } from './friend-code';

/** Prisma's code for "the record to update does not exist". */
const RECORD_NOT_FOUND = 'P2025';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

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
