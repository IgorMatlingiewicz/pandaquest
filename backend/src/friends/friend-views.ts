import { BADGES, type BadgeDefinition } from '../badges/badges.config';
import type { BadgeTier, FriendshipStatus } from '../generated/prisma/client';
import { resendAvailableAt } from './friend-requests.logic';

/*
 * What the friends endpoints answer, built field by field from an explicit
 * list (privacy by default, GDPR art. 25(2)): never a database row passed
 * on, so a column added to users later cannot leak by itself. Of another
 * user, requests and the friends list show only the display name and the
 * level; a friend's profile adds the showcase, the badge count and the join
 * date, and their badges list what they earned. Streaks, tasks, statistics,
 * email and XP are never shown.
 */

/** The other side of a request, as anyone involved may see them. */
export type PersonView = { username: string; level: number };

export type RequestView = {
  id: string;
  user: PersonView;
  status: FriendshipStatus;
  createdAt: Date;
  /** Only for a declined request: when its sender may ask again. */
  resendAvailableAt?: Date;
};

export function personView(user: PersonView): PersonView {
  return { username: user.username, level: user.level };
}

export function requestView(
  row: {
    id: string;
    status: FriendshipStatus;
    createdAt: Date;
    respondedAt: Date | null;
  },
  other: PersonView,
): RequestView {
  const view: RequestView = {
    id: row.id,
    user: personView(other),
    status: row.status,
    createdAt: row.createdAt,
  };
  if (row.status === 'DECLINED' && row.respondedAt) {
    view.resendAvailableAt = resendAvailableAt(row.respondedAt);
  }
  return view;
}

/** One friend in the list; the friendship's id addresses everything else. */
export type FriendView = PersonView & { friendshipId: string };

export function friendView(
  friendshipId: string,
  other: PersonView,
): FriendView {
  return { friendshipId, ...personView(other) };
}

type ShowcaseBadge = { badgeKey: string; tier: BadgeTier; earnedAt: Date };

export type FriendProfileView = {
  username: string;
  level: number;
  joinedAt: Date;
  badges: { earned: number; total: number };
  favorites: (ShowcaseBadge | null)[];
};

/**
 * A friend's profile from the same data as the user's own (ProfileService),
 * cut down: levelProgress is left out, as it is made of XP.
 */
export function friendProfileView(
  profile: FriendProfileView,
): FriendProfileView {
  return {
    username: profile.username,
    level: profile.level,
    joinedAt: profile.joinedAt,
    badges: { earned: profile.badges.earned, total: profile.badges.total },
    favorites: profile.favorites.map(
      (badge) =>
        badge && {
          badgeKey: badge.badgeKey,
          tier: badge.tier,
          earnedAt: badge.earnedAt,
        },
    ),
  };
}

export type FriendBadgeView = {
  key: string;
  tiers: { tier: BadgeTier; threshold: number; earnedAt: Date }[];
};

/**
 * The badges a friend earned, in catalog order with the lowest tier first,
 * like the achievements screen but earned tiers only and without `current`:
 * that value is the friend's progress, i.e. their statistics. The threshold
 * comes from the catalog, the same for everybody. A stored tier no longer in
 * the catalog is left out, as the badge count leaves it out.
 */
export function friendBadgesView(
  earned: readonly ShowcaseBadge[],
  catalog: readonly BadgeDefinition[] = BADGES,
): FriendBadgeView[] {
  const earnedAt = new Map(
    earned.map((badge) => [`${badge.badgeKey}|${badge.tier}`, badge.earnedAt]),
  );
  return catalog.flatMap((badge) => {
    const tiers = badge.tiers.flatMap((rule) => {
      const at = earnedAt.get(`${badge.key}|${rule.tier}`);
      return at
        ? [{ tier: rule.tier, threshold: rule.threshold, earnedAt: at }]
        : [];
    });
    return tiers.length > 0 ? [{ key: badge.key, tiers }] : [];
  });
}
