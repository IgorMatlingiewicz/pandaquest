import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { badgeCounts } from '../badges/badges.logic';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { levelProgress } from '../xp/xp.logic';
import { UpdateFavoriteBadgesDto } from './dto/update-favorite-badges.dto';
import {
  favoriteSlots,
  parseFavoriteSlots,
  type FavoriteSlot,
  type SlotsProblem,
} from './profile.logic';

const PROBLEM_MESSAGES: Record<SlotsProblem, string> = {
  length: 'Gablotka ma dokładnie 3 miejsca',
  shape: 'Nieprawidłowa odznaka w gablotce',
  unknown: 'Nieznana odznaka',
  duplicate: 'Ta sama odznaka w dwóch miejscach',
};

/*
 * The user's own profile: who they are, how far they got and the showcase of
 * up to three earned badges. Read with a fixed set of queries; /auth/me stays
 * light, as the app calls it on every start.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, createdAt: true, xpTotal: true, level: true },
    });
    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }
    const earned = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeKey: true, tier: true },
    });

    return {
      username: user.username,
      joinedAt: user.createdAt,
      level: user.level,
      levelProgress: levelProgress(user.xpTotal),
      badges: badgeCounts(earned),
      favorites: await this.readFavorites(this.prisma, userId),
    };
  }

  /**
   * Replaces the whole showcase. Ownership is checked and the old entries
   * swapped for the new ones in one transaction, so the showcase is never
   * half old and half new; sending the same body again changes nothing.
   */
  async setFavorites(
    userId: string,
    dto: UpdateFavoriteBadgesDto,
  ): Promise<(FavoriteSlot | null)[]> {
    const parsed = parseFavoriteSlots(dto.slots);
    if (!parsed.ok) {
      throw new BadRequestException(PROBLEM_MESSAGES[parsed.reason]);
    }
    const wanted = parsed.slots.flatMap((pick, slot) =>
      pick ? [{ ...pick, slot }] : [],
    );
    const keyOf = (badge: { badgeKey: string; tier: string }) =>
      `${badge.badgeKey}|${badge.tier}`;

    return this.prisma.$transaction(async (tx) => {
      const owned =
        wanted.length === 0
          ? []
          : await tx.userBadge.findMany({
              where: {
                userId,
                OR: wanted.map(({ badgeKey, tier }) => ({ badgeKey, tier })),
              },
              select: { id: true, badgeKey: true, tier: true },
            });
      const idOf = new Map(owned.map((badge) => [keyOf(badge), badge.id]));
      // 404, not 403: whether another user has the badge is not told.
      if (wanted.some((pick) => !idOf.has(keyOf(pick)))) {
        throw new NotFoundException('Odznaka nie znaleziona');
      }

      await tx.favoriteBadge.deleteMany({ where: { userId } });
      if (wanted.length > 0) {
        await tx.favoriteBadge.createMany({
          data: wanted.map((pick) => ({
            userId,
            slot: pick.slot,
            userBadgeId: idOf.get(keyOf(pick))!,
          })),
        });
      }
      return this.readFavorites(tx, userId);
    });
  }

  private async readFavorites(tx: Prisma.TransactionClient, userId: string) {
    const rows = await tx.favoriteBadge.findMany({
      where: { userId },
      select: {
        slot: true,
        userBadge: { select: { badgeKey: true, tier: true, earnedAt: true } },
      },
    });
    return favoriteSlots(rows);
  }
}
