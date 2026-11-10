import { TIER_ORDER } from "@/constants/badge-tiers";
import type { Achievement, EarnedBadge, FavoritePick } from "@/types/api";

/*
 * The profile screen without React: the showcase, the badge picker and the
 * password form. Pure functions: no fetching, no translations.
 */

/** As FAVORITE_SLOTS in backend/src/profile; GET /profile always sends 3. */
export const SHOWCASE_SLOTS = 3;

type Slot = EarnedBadge | FavoritePick | null;

const keyOf = (badge: FavoritePick) => `${badge.badgeKey}|${badge.tier}`;

/**
 * The whole showcase with one slot set: a badge fills or replaces it, null
 * empties it. Always SHOWCASE_SLOTS long and made of picks only, so it is
 * the body of PUT /profile/favorite-badges as it is. The input stays as it
 * was.
 */
export function withSlot(
  slots: readonly Slot[],
  index: number,
  pick: FavoritePick | null,
): (FavoritePick | null)[] {
  return Array.from({ length: SHOWCASE_SLOTS }, (_, slot) => {
    const badge = slot === index ? pick : (slots[slot] ?? null);
    return badge && { badgeKey: badge.badgeKey, tier: badge.tier };
  });
}

/** Every earned tier of GET /achievements as an entry of its own. */
export function earnedBadges(
  achievements: readonly Achievement[],
): EarnedBadge[] {
  return achievements.flatMap((achievement) =>
    achievement.tiers.flatMap((tier) =>
      tier.earnedAt === null
        ? []
        : [
            {
              badgeKey: achievement.key,
              tier: tier.tier,
              earnedAt: tier.earnedAt,
            },
          ],
    ),
  );
}

/**
 * What the picker offers: earned badges not in the showcase yet (the server
 * refuses one badge twice), highest tier first, then the newest first.
 */
export function pickerOptions(
  earned: readonly EarnedBadge[],
  showcase: readonly (EarnedBadge | null)[],
): EarnedBadge[] {
  const shown = new Set(
    showcase.flatMap((badge) => (badge ? [keyOf(badge)] : [])),
  );
  return earned
    .filter((badge) => !shown.has(keyOf(badge)))
    .sort(
      (a, b) =>
        TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier) ||
        Date.parse(b.earnedAt) - Date.parse(a.earnedAt),
    );
}

export type ShowcaseSlot =
  | { slot: number; kind: "empty" }
  | ({ slot: number; kind: "badge" } & EarnedBadge);

/** The showcase in slot order, an empty slot wherever there is no badge. */
export function showcaseView(
  favorites: readonly (EarnedBadge | null)[],
): ShowcaseSlot[] {
  return Array.from({ length: SHOWCASE_SLOTS }, (_, slot) => {
    const badge = favorites[slot] ?? null;
    return badge
      ? { slot, kind: "badge" as const, ...badge }
      : { slot, kind: "empty" as const };
  });
}

export type PasswordForm = { current: string; next: string; repeat: string };

export type PasswordFormErrors = Partial<Record<keyof PasswordForm, string>>;

/**
 * Only what the client can tell on its own: nothing left empty, and the new
 * password typed the same twice. How strong it must be is the server's rule;
 * its answer is shown instead of a copy of that rule here.
 */
export function validatePasswordForm(form: PasswordForm): PasswordFormErrors {
  const errors: PasswordFormErrors = {};
  for (const field of ["current", "next", "repeat"] as const) {
    if (form[field] === "") errors[field] = "profile.password.required";
  }
  // Compared only once both are typed: an empty field already says enough.
  if (!errors.next && !errors.repeat && form.repeat !== form.next) {
    errors.repeat = "profile.password.mismatch";
  }
  return errors;
}
