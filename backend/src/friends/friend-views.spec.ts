import type { BadgeDefinition } from '../badges/badges.config';
import { RESEND_COOLDOWN_MS } from './friends.config';
import {
  friendBadgesView,
  friendProfileView,
  friendView,
  personView,
  requestView,
  type FriendProfileView,
} from './friend-views';

const CREATED = new Date('2026-11-10T10:00:00.000Z');
const RESPONDED = new Date('2026-11-11T10:00:00.000Z');

// A row as Prisma could return it with more than asked for: none of the
// extras may reach the answer.
const userWithEverything = {
  username: 'panda',
  level: 7,
  email: 'panda@example.com',
  passwordHash: 'secret',
  xpTotal: 4200,
  friendCode: 'ABCDEFGH',
  timezone: 'Europe/Warsaw',
};

describe('personView', () => {
  it('shows exactly the display name and the level', () => {
    expect(personView(userWithEverything)).toEqual({
      username: 'panda',
      level: 7,
    });
  });
});

describe('requestView', () => {
  const row = {
    id: 'request-1',
    status: 'PENDING' as const,
    createdAt: CREATED,
    respondedAt: null,
    requesterId: 'user-a',
    addresseeId: 'user-b',
  };

  it('shows exactly the id, the other person, the status and the date', () => {
    const view = requestView(row, userWithEverything);

    expect(view).toEqual({
      id: 'request-1',
      user: { username: 'panda', level: 7 },
      status: 'PENDING',
      createdAt: CREATED,
    });
    expect(Object.keys(view).sort()).toEqual(
      ['createdAt', 'id', 'status', 'user'].sort(),
    );
  });

  it('tells, for a declined request, when its sender may ask again', () => {
    const view = requestView(
      { ...row, status: 'DECLINED', respondedAt: RESPONDED },
      userWithEverything,
    );

    expect(view.resendAvailableAt).toEqual(
      new Date(RESPONDED.getTime() + RESEND_COOLDOWN_MS),
    );
    expect(Object.keys(view).sort()).toEqual(
      ['createdAt', 'id', 'resendAvailableAt', 'status', 'user'].sort(),
    );
  });

  it('keeps the answer time to itself for other statuses', () => {
    const view = requestView(
      { ...row, status: 'ACCEPTED', respondedAt: RESPONDED },
      userWithEverything,
    );

    expect(view).not.toHaveProperty('resendAvailableAt');
    expect(view).not.toHaveProperty('respondedAt');
  });
});

describe('friendView', () => {
  it('shows exactly the friendship id, the display name and the level', () => {
    expect(friendView('friendship-1', userWithEverything)).toEqual({
      friendshipId: 'friendship-1',
      username: 'panda',
      level: 7,
    });
  });
});

describe('friendProfileView', () => {
  const EARNED = new Date('2026-10-01T08:00:00.000Z');
  const JOINED = new Date('2026-09-01T10:00:00.000Z');
  // The user's own profile as ProfileService builds it, plus stray extras.
  const ownProfile = {
    username: 'panda',
    joinedAt: JOINED,
    level: 7,
    levelProgress: {
      level: 7,
      xpIntoLevel: 50,
      xpForNextLevel: 160,
      isMax: false,
    },
    badges: { earned: 3, total: 26, xpTotal: 4200 },
    favorites: [
      {
        badgeKey: 'first_day',
        tier: 'BRONZE' as const,
        earnedAt: EARNED,
        userId: 'u-1',
      },
      null,
      null,
    ],
    email: 'panda@example.com',
  } as unknown as FriendProfileView;

  it('shows exactly name, level, join date, badge count and showcase', () => {
    const view = friendProfileView(ownProfile);

    expect(view).toEqual({
      username: 'panda',
      level: 7,
      joinedAt: JOINED,
      badges: { earned: 3, total: 26 },
      favorites: [
        { badgeKey: 'first_day', tier: 'BRONZE', earnedAt: EARNED },
        null,
        null,
      ],
    });
  });

  it('leaves out levelProgress, as it is made of XP', () => {
    expect(friendProfileView(ownProfile)).not.toHaveProperty('levelProgress');
    expect(JSON.stringify(friendProfileView(ownProfile))).not.toMatch(/xp/i);
  });
});

describe('friendBadgesView', () => {
  const at = (day: number) => new Date(Date.UTC(2026, 9, day, 8));
  const CATALOG: BadgeDefinition[] = [
    {
      key: 'streak',
      metric: 'dailyStreak',
      tiers: [
        { tier: 'BRONZE', threshold: 3 },
        { tier: 'SILVER', threshold: 5 },
        { tier: 'GOLD', threshold: 10 },
      ],
    },
    {
      key: 'goal',
      metric: 'lifeGoalCompleted',
      tiers: [{ tier: 'DIAMOND', threshold: 1 }],
    },
    {
      key: 'categories',
      metric: 'ownCategoryCount',
      tiers: [{ tier: 'SILVER', threshold: 7 }],
    },
  ];

  it('lists earned tiers only, in catalog order, lowest tier first', () => {
    const view = friendBadgesView(
      [
        { badgeKey: 'goal', tier: 'DIAMOND', earnedAt: at(9) },
        { badgeKey: 'streak', tier: 'SILVER', earnedAt: at(5) },
        { badgeKey: 'streak', tier: 'BRONZE', earnedAt: at(3) },
      ],
      CATALOG,
    );

    expect(view).toEqual([
      {
        key: 'streak',
        tiers: [
          { tier: 'BRONZE', threshold: 3, earnedAt: at(3) },
          { tier: 'SILVER', threshold: 5, earnedAt: at(5) },
        ],
      },
      {
        key: 'goal',
        tiers: [{ tier: 'DIAMOND', threshold: 1, earnedAt: at(9) }],
      },
    ]);
  });

  it('says nothing of progress: no current value, no unearned tier', () => {
    const view = friendBadgesView(
      [{ badgeKey: 'streak', tier: 'BRONZE', earnedAt: at(3) }],
      CATALOG,
    );

    expect(view[0]).not.toHaveProperty('current');
    expect(view[0].tiers.map((t) => t.tier)).toEqual(['BRONZE']);
    expect(Object.keys(view[0].tiers[0]).sort()).toEqual(
      ['earnedAt', 'threshold', 'tier'].sort(),
    );
  });

  it('leaves out a tier the catalog no longer has, and is empty with none', () => {
    expect(
      friendBadgesView(
        [{ badgeKey: 'retired', tier: 'GOLD', earnedAt: at(1) }],
        CATALOG,
      ),
    ).toEqual([]);
    expect(friendBadgesView([], CATALOG)).toEqual([]);
  });

  it('uses the real catalog by default', () => {
    expect(
      friendBadgesView([
        { badgeKey: 'first_day', tier: 'BRONZE', earnedAt: at(1) },
      ]),
    ).toEqual([
      {
        key: 'first_day',
        tiers: [{ tier: 'BRONZE', threshold: 1, earnedAt: at(1) }],
      },
    ]);
  });
});
