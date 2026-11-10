import { BADGES, type BadgeDefinition } from '../badges/badges.config';
import type { BadgeTier } from '../generated/prisma/client';
import { FAVORITE_SLOTS } from './profile.config';

/*
 * The profile showcase, without the database: checking what a client sends
 * and laying the stored entries out in slot order. Only keys travel; names
 * and descriptions of badges live in the app's translations.
 */

export type FavoritePick = { badgeKey: string; tier: BadgeTier };

export type FavoriteSlot = FavoritePick & { earnedAt: Date };

/** Why a showcase was refused; each reason is a 400 for the client. */
export type SlotsProblem = 'length' | 'shape' | 'unknown' | 'duplicate';

export type ParsedSlots =
  | { ok: true; slots: (FavoritePick | null)[] }
  | { ok: false; reason: SlotsProblem };

// Object() turns any value into something its fields can be read from: a
// string, number or array simply has no badgeKey, so it fails the check.
function isPickShape(
  value: unknown,
): value is { badgeKey: string; tier: string } {
  const { badgeKey, tier } = Object(value) as Record<string, unknown>;
  return typeof badgeKey === 'string' && typeof tier === 'string';
}

/**
 * Checks a whole showcase as the client sent it: exactly FAVORITE_SLOTS
 * entries, each null (an empty slot) or a badge tier the catalog has, and no
 * tier twice. Whether the user earned them is the service's question.
 */
export function parseFavoriteSlots(
  slots: readonly unknown[],
  catalog: readonly BadgeDefinition[] = BADGES,
): ParsedSlots {
  if (slots.length !== FAVORITE_SLOTS) return { ok: false, reason: 'length' };

  const picks: (FavoritePick | null)[] = [];
  for (const slot of slots) {
    if (slot === null) {
      picks.push(null);
      continue;
    }
    if (!isPickShape(slot)) return { ok: false, reason: 'shape' };
    const known = catalog.some(
      (badge) =>
        badge.key === slot.badgeKey &&
        badge.tiers.some((rule) => rule.tier === slot.tier),
    );
    if (!known) return { ok: false, reason: 'unknown' };
    // A new object: anything else the client put in the slot is dropped.
    picks.push({ badgeKey: slot.badgeKey, tier: slot.tier as BadgeTier });
  }

  const keys = picks.flatMap((pick) =>
    pick ? [`${pick.badgeKey}|${pick.tier}`] : [],
  );
  if (new Set(keys).size !== keys.length) {
    return { ok: false, reason: 'duplicate' };
  }
  return { ok: true, slots: picks };
}

/**
 * The showcase in slot order, always FAVORITE_SLOTS long, null where a slot
 * is empty. The order comes from the slot numbers, not from the rows.
 */
export function favoriteSlots(
  rows: readonly { slot: number; userBadge: FavoriteSlot }[],
): (FavoriteSlot | null)[] {
  return Array.from(
    { length: FAVORITE_SLOTS },
    (_, slot) => rows.find((row) => row.slot === slot)?.userBadge ?? null,
  );
}
