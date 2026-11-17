import {
  reminderView,
  shouldShowReminders,
  unseenReminders,
  type ShowInput,
} from "@/lib/reminders";
import type { Reminder } from "@/types/api";

const daily = (remaining = 2, streak?: number): Reminder => ({
  key: "daily:2026-11-17",
  type: "DAILY_EVENING",
  payload: {
    remaining,
    ...(streak ? { atRiskStreak: { unit: "DAY", length: streak } } : {}),
  },
});
const weekly = (streak?: number): Reminder => ({
  key: "weekly:2026-W47",
  type: "WEEKLY_LAST_DAY",
  payload: {
    remaining: 1,
    ...(streak ? { atRiskStreak: { unit: "WEEK", length: streak } } : {}),
  },
});
const invite = (id: string, count: number): Reminder => ({
  key: `friend_invite:${id}:1794301200123`,
  type: "FRIEND_INVITE",
  payload: { count },
});

const NONE = new Set<string>();

describe("unseenReminders", () => {
  it("leaves out what this session already showed", () => {
    const shown = new Set([daily().key]);

    expect(unseenReminders([daily(), weekly()], shown)).toEqual([weekly()]);
  });

  it("is empty for an empty list", () => {
    expect(unseenReminders([], NONE)).toEqual([]);
  });
});

describe("reminderView", () => {
  it("is null when the server sent nothing", () => {
    expect(reminderView([], NONE)).toBeNull();
  });

  it("is null once everything was shown in this session", () => {
    const all = [daily(), invite("a", 1)];

    expect(reminderView(all, new Set(all.map((r) => r.key)))).toBeNull();
  });

  it("lists daily, weekly, friends in this order, whatever order they came in", () => {
    const view = reminderView([invite("a", 1), weekly(), daily()], NONE);

    expect(view?.items.map((item) => item.kind)).toEqual([
      "daily",
      "weekly",
      "friends",
    ]);
  });

  it("carries the number of open tasks", () => {
    expect(reminderView([daily(3)], NONE)?.items).toEqual([
      { kind: "daily", remaining: 3, streak: null },
    ]);
  });

  it("has no streak line without atRiskStreak", () => {
    const view = reminderView([daily(), weekly()], NONE);

    expect(view?.items.map((item) => "streak" in item && item.streak)).toEqual([
      null,
      null,
    ]);
  });

  it("names the streak at risk when the server sent one", () => {
    expect(reminderView([daily(1, 4), weekly(2)], NONE)?.items).toEqual([
      { kind: "daily", remaining: 1, streak: 4 },
      { kind: "weekly", remaining: 1, streak: 2 },
    ]);
  });

  it("turns the friend requests into one line with their count", () => {
    const view = reminderView(
      [invite("a", 3), invite("b", 3), invite("c", 3)],
      NONE,
    );

    expect(view?.items).toEqual([{ kind: "friends", count: 3 }]);
  });

  it("keeps the server's count when it listed fewer requests than there are", () => {
    // The server lists at most 10 reminders; count is the true number.
    const listed = Array.from({ length: 8 }, (_, i) => invite(`r${i}`, 12));

    expect(
      reminderView([daily(), weekly(), ...listed], NONE)?.items[2],
    ).toEqual({ kind: "friends", count: 12 });
  });

  it("takes requests already shown in this session off the count", () => {
    const [a, b, c] = [invite("a", 3), invite("b", 3), invite("c", 3)];

    const view = reminderView([a, b, c], new Set([a.key]));

    expect(view?.items).toEqual([{ kind: "friends", count: 2 }]);
    expect(view?.keys).toEqual([b.key, c.key]);
  });

  it("confirms every key it stands for, and only those", () => {
    const shownBefore = invite("old", 2);
    const reminders = [daily(), weekly(), shownBefore, invite("new", 2)];

    const view = reminderView(reminders, new Set([shownBefore.key]));

    expect(view?.keys).toEqual([
      daily().key,
      weekly().key,
      invite("new", 2).key,
    ]);
  });

  it("leaves out a type the app does not know, and does not confirm it", () => {
    const unknown = {
      key: "monthly:2026-11",
      type: "MONTHLY_SUMMARY",
      payload: {},
    } as unknown as Reminder;

    expect(reminderView([unknown], NONE)).toBeNull();
    expect(reminderView([unknown, daily()], NONE)?.keys).toEqual([daily().key]);
  });
});

describe("shouldShowReminders", () => {
  const ready: ShowInput = {
    enabled: true,
    authenticated: true,
    tutorialActive: false,
    rewardsPending: false,
    reminders: [daily()],
    shownKeys: NONE,
  };

  it("shows when nothing else is on screen and there is something new", () => {
    expect(shouldShowReminders(ready)).toBe(true);
  });

  it.each([
    ["the switch is off", { enabled: false }],
    ["on the login or sign-up screen", { authenticated: false }],
    ["the tutorial is on screen", { tutorialActive: true }],
    ["a reward window is on screen or waiting", { rewardsPending: true }],
    ["the server sent nothing", { reminders: [] }],
    ["this session already showed it", { shownKeys: new Set([daily().key]) }],
  ])("waits when %s", (_, change) => {
    expect(shouldShowReminders({ ...ready, ...change })).toBe(false);
  });

  it("waits for both the tutorial and the rewards, then shows", () => {
    const both = { ...ready, tutorialActive: true, rewardsPending: true };

    expect(shouldShowReminders(both)).toBe(false);
    // The tutorial ends and lets the held badge show: still waiting.
    expect(shouldShowReminders({ ...both, tutorialActive: false })).toBe(false);
    // The badge window is closed too: now.
    expect(
      shouldShowReminders({
        ...both,
        tutorialActive: false,
        rewardsPending: false,
      }),
    ).toBe(true);
  });
});
