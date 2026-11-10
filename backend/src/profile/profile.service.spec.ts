import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BADGES } from '../badges/badges.config';
import { BadgesService } from '../badges/badges.service';
import type { BadgeTier } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { createFakePrisma, OWNER } from '../testing/fake-prisma';
import { levelProgress } from '../xp/xp.logic';
import { ProfileService } from './profile.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const STRANGER = 'user-stranger';
const NOW = new Date('2026-11-10T12:00:00Z');
const EARNED_AT = new Date('2026-11-01T08:00:00Z');
const TOTAL_TIERS = BADGES.reduce((sum, badge) => sum + badge.tiers.length, 0);

const pick = (badgeKey: string, tier: BadgeTier) => ({ badgeKey, tier });
const FIRST_DAY = pick('first_day', 'BRONZE');
const FIRST_WEEK = pick('first_week', 'BRONZE');
const LIFE_GOAL = pick('life_goal', 'DIAMOND');
const STREAK_GOLD = pick('daily_streak', 'GOLD');

describe('ProfileService', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let prisma: PrismaService;
  let service: ProfileService;

  const earn = (badge: { badgeKey: string; tier: BadgeTier }, userId = OWNER) =>
    fake.userBadges.push({
      id: `${userId}|${badge.badgeKey}|${badge.tier}`,
      userId,
      ...badge,
      earnedAt: EARNED_AT,
    });
  const shown = (badge: { badgeKey: string; tier: BadgeTier }) => ({
    ...badge,
    earnedAt: EARNED_AT,
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    fake = createFakePrisma();
    prisma = fake.prisma as unknown as PrismaService;
    service = new ProfileService(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('getProfile', () => {
    it('shows a fresh user with no badges and an empty showcase', async () => {
      const profile = await service.getProfile(OWNER);

      expect(profile).toEqual({
        username: 'owner',
        joinedAt: new Date('2026-09-01T10:00:00Z'),
        level: 1,
        levelProgress: levelProgress(0),
        badges: { earned: 0, total: TOTAL_TIERS },
        favorites: [null, null, null],
      });
    });

    it('takes the level from the user, as /auth/me does', async () => {
      fake.user.xpTotal = 250;
      fake.user.level = 3;

      const profile = await service.getProfile(OWNER);

      expect(profile.level).toBe(3);
      expect(profile.levelProgress).toEqual(levelProgress(250));
    });

    it('counts badges exactly as the achievements screen does', async () => {
      earn(FIRST_DAY);
      earn(STREAK_GOLD);
      earn(LIFE_GOAL);
      // A tier no longer in the catalog counts neither way.
      earn(pick('retired_badge', 'GOLD'));

      const profile = await service.getProfile(OWNER);
      const tiers = (
        await new BadgesService(prisma).getAchievements(OWNER)
      ).flatMap((achievement) => achievement.tiers);

      expect(profile.badges).toEqual({ earned: 3, total: TOTAL_TIERS });
      expect(profile.badges).toEqual({
        earned: tiers.filter((tier) => tier.earnedAt !== null).length,
        total: tiers.length,
      });
    });

    it('shows a showcase with a gap in slot order', async () => {
      earn(FIRST_DAY);
      earn(LIFE_GOAL);
      await service.setFavorites(OWNER, {
        slots: [LIFE_GOAL, null, FIRST_DAY],
      });

      const { favorites } = await service.getProfile(OWNER);

      expect(favorites).toEqual([shown(LIFE_GOAL), null, shown(FIRST_DAY)]);
    });

    it('is not moved by the badges and showcase of another user', async () => {
      earn(FIRST_DAY, STRANGER);
      earn(LIFE_GOAL, STRANGER);
      await service.setFavorites(STRANGER, {
        slots: [FIRST_DAY, LIFE_GOAL, null],
      });

      const profile = await service.getProfile(OWNER);

      expect(profile.badges.earned).toBe(0);
      expect(profile.favorites).toEqual([null, null, null]);
    });

    it('answers 404 for a user that no longer exists', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

      await expect(service.getProfile(OWNER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reads a fixed set of three queries', async () => {
      const users = jest.spyOn(prisma.user, 'findUnique');
      const badges = jest.spyOn(prisma.userBadge, 'findMany');
      const favorites = jest.spyOn(prisma.favoriteBadge, 'findMany');
      for (const badge of [FIRST_DAY, FIRST_WEEK, LIFE_GOAL]) earn(badge);

      await service.getProfile(OWNER);

      expect(users).toHaveBeenCalledTimes(1);
      expect(badges).toHaveBeenCalledTimes(1);
      expect(favorites).toHaveBeenCalledTimes(1);
    });
  });

  describe('setFavorites', () => {
    beforeEach(() => {
      for (const badge of [FIRST_DAY, FIRST_WEEK, LIFE_GOAL, STREAK_GOLD]) {
        earn(badge);
      }
    });

    it('fills all three slots and answers with the showcase', async () => {
      const result = await service.setFavorites(OWNER, {
        slots: [FIRST_DAY, LIFE_GOAL, FIRST_WEEK],
      });

      expect(result).toEqual([
        shown(FIRST_DAY),
        shown(LIFE_GOAL),
        shown(FIRST_WEEK),
      ]);
      expect(fake.favoriteBadges).toHaveLength(3);
    });

    it('replaces the whole showcase, also moving a badge to another slot', async () => {
      await service.setFavorites(OWNER, {
        slots: [FIRST_DAY, LIFE_GOAL, FIRST_WEEK],
      });

      const result = await service.setFavorites(OWNER, {
        slots: [LIFE_GOAL, STREAK_GOLD, null],
      });

      expect(result).toEqual([shown(LIFE_GOAL), shown(STREAK_GOLD), null]);
      expect(fake.favoriteBadges).toHaveLength(2);
    });

    it('empties the showcase with three nulls', async () => {
      await service.setFavorites(OWNER, {
        slots: [FIRST_DAY, LIFE_GOAL, FIRST_WEEK],
      });

      const result = await service.setFavorites(OWNER, {
        slots: [null, null, null],
      });

      expect(result).toEqual([null, null, null]);
      expect(fake.favoriteBadges).toHaveLength(0);
    });

    it.each([
      ['one badge', [null, FIRST_DAY, null], [null, shown(FIRST_DAY), null]],
      [
        'two badges',
        [FIRST_WEEK, null, LIFE_GOAL],
        [shown(FIRST_WEEK), null, shown(LIFE_GOAL)],
      ],
    ])('fills %s and leaves the rest empty', async (_, slots, expected) => {
      await expect(service.setFavorites(OWNER, { slots })).resolves.toEqual(
        expected,
      );
    });

    it('gives the same result when sent twice', async () => {
      const dto = { slots: [FIRST_DAY, null, LIFE_GOAL] };

      const first = await service.setFavorites(OWNER, dto);
      const second = await service.setFavorites(OWNER, dto);

      expect(second).toEqual(first);
      expect(fake.favoriteBadges).toHaveLength(2);
    });

    it('does all of it in one transaction', async () => {
      const transaction = jest.spyOn(prisma, '$transaction');

      await service.setFavorites(OWNER, { slots: [FIRST_DAY, null, null] });

      expect(transaction).toHaveBeenCalledTimes(1);
    });

    describe('refuses', () => {
      const refuse = async (slots: unknown[], error: unknown) => {
        await service.setFavorites(OWNER, { slots: [FIRST_DAY, null, null] });

        await expect(
          service.setFavorites(OWNER, { slots }),
        ).rejects.toBeInstanceOf(error as new () => Error);
        // The showcase before the refusal is still there.
        expect(await service.getProfile(OWNER)).toMatchObject({
          favorites: [shown(FIRST_DAY), null, null],
        });
      };

      it('the same badge in two slots with 400', () =>
        refuse([LIFE_GOAL, null, LIFE_GOAL], BadRequestException));

      it('the wrong number of slots with 400', () =>
        refuse([LIFE_GOAL, null], BadRequestException));

      it('a badge outside the catalog with 400', () =>
        refuse([pick('nope', 'BRONZE'), null, null], BadRequestException));

      it('a tier the badge does not have with 400', () =>
        refuse([pick('first_day', 'GOLD'), null, null], BadRequestException));

      it('a badge this user has not earned with 404', () =>
        refuse([pick('weekly_streak', 'GOLD'), null, null], NotFoundException));

      it('a badge only another user earned with 404', () => {
        earn(pick('own_category_all_done', 'SILVER'), STRANGER);
        return refuse(
          [pick('own_category_all_done', 'SILVER'), null, null],
          NotFoundException,
        );
      });
    });
  });
});
