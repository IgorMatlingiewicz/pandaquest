import type { BadgeDefinition } from '../badges/badges.config';
import {
  favoriteSlots,
  parseFavoriteSlots,
  type FavoriteSlot,
} from './profile.logic';

// A small catalog of its own, so these tests do not change when the real
// one does.
const CATALOG: BadgeDefinition[] = [
  {
    key: 'streak',
    metric: 'dailyStreak',
    tiers: [
      { tier: 'BRONZE', threshold: 3 },
      { tier: 'SILVER', threshold: 5 },
    ],
  },
  {
    key: 'first',
    metric: 'dailyTotal',
    tiers: [{ tier: 'BRONZE', threshold: 1 }],
  },
];

const bronze = { badgeKey: 'streak', tier: 'BRONZE' };
const silver = { badgeKey: 'streak', tier: 'SILVER' };
const first = { badgeKey: 'first', tier: 'BRONZE' };

const parse = (slots: unknown[]) => parseFavoriteSlots(slots, CATALOG);

describe('parseFavoriteSlots', () => {
  it('accepts three badges', () => {
    expect(parse([bronze, silver, first])).toEqual({
      ok: true,
      slots: [bronze, silver, first],
    });
  });

  it('accepts empty slots anywhere', () => {
    expect(parse([bronze, null, first])).toEqual({
      ok: true,
      slots: [bronze, null, first],
    });
    expect(parse([null, null, null])).toEqual({
      ok: true,
      slots: [null, null, null],
    });
  });

  it('keeps only the badge key and tier of a slot', () => {
    const result = parse([{ ...bronze, earnedAt: 'x', id: 'y' }, null, null]);

    expect(result).toEqual({ ok: true, slots: [bronze, null, null] });
  });

  it.each([
    ['two slots', [bronze, silver]],
    ['four slots', [bronze, silver, first, null]],
    ['no slots', []],
  ])('refuses %s', (_, slots) => {
    expect(parse(slots)).toEqual({ ok: false, reason: 'length' });
  });

  it.each([
    ['a string', 'streak'],
    ['a number', 7],
    ['a missing tier', { badgeKey: 'streak' }],
    ['a missing key', { tier: 'BRONZE' }],
    ['a tier that is not text', { badgeKey: 'streak', tier: 1 }],
    ['an array', ['streak', 'BRONZE']],
  ])('refuses a slot that is %s', (_, slot) => {
    expect(parse([slot, null, null])).toEqual({ ok: false, reason: 'shape' });
  });

  it.each([
    ['a key outside the catalog', { badgeKey: 'nope', tier: 'BRONZE' }],
    ['a tier the badge does not have', { badgeKey: 'first', tier: 'GOLD' }],
    ['a tier that does not exist', { badgeKey: 'streak', tier: 'PLATINUM' }],
  ])('refuses %s', (_, slot) => {
    expect(parse([null, slot, null])).toEqual({ ok: false, reason: 'unknown' });
  });

  it('refuses the same badge in two slots', () => {
    expect(parse([bronze, null, bronze])).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('allows two tiers of one badge', () => {
    expect(parse([bronze, silver, null])).toMatchObject({ ok: true });
  });
});

describe('favoriteSlots', () => {
  const at = new Date('2026-11-10T10:00:00Z');
  const row = (
    slot: number,
    badgeKey: string,
  ): { slot: number; userBadge: FavoriteSlot } => ({
    slot,
    userBadge: { badgeKey, tier: 'BRONZE', earnedAt: at },
  });

  it('is three empty slots without any rows', () => {
    expect(favoriteSlots([])).toEqual([null, null, null]);
  });

  it('puts each badge in its own slot and leaves the gap empty', () => {
    expect(favoriteSlots([row(0, 'a'), row(2, 'c')])).toEqual([
      { badgeKey: 'a', tier: 'BRONZE', earnedAt: at },
      null,
      { badgeKey: 'c', tier: 'BRONZE', earnedAt: at },
    ]);
  });

  it('orders by the slot, not by the order of the rows', () => {
    const slots = favoriteSlots([row(2, 'c'), row(0, 'a'), row(1, 'b')]);

    expect(slots.map((slot) => slot?.badgeKey)).toEqual(['a', 'b', 'c']);
  });
});
