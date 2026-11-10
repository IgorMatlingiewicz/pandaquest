import {
  earnedBadges,
  pickerOptions,
  showcaseView,
  SHOWCASE_SLOTS,
  validatePasswordForm,
  withSlot,
} from "@/lib/profile";
import type {
  Achievement,
  BadgeTier,
  EarnedBadge,
  FavoritePick,
} from "@/types/api";

const pick = (badgeKey: string, tier: BadgeTier): FavoritePick => ({
  badgeKey,
  tier,
});
const earned = (
  badgeKey: string,
  tier: BadgeTier,
  earnedAt = "2026-10-01T08:00:00.000Z",
): EarnedBadge => ({ badgeKey, tier, earnedAt });

const FIRST_DAY = earned("first_day", "BRONZE");
const LIFE_GOAL = earned("life_goal", "DIAMOND");
const STREAK_GOLD = earned("daily_streak", "GOLD");

describe("withSlot", () => {
  it("fills an empty slot and keeps the others", () => {
    expect(
      withSlot([FIRST_DAY, null, null], 1, pick("life_goal", "DIAMOND")),
    ).toEqual([
      pick("first_day", "BRONZE"),
      pick("life_goal", "DIAMOND"),
      null,
    ]);
  });

  it("replaces the badge in a taken slot", () => {
    expect(
      withSlot([FIRST_DAY, LIFE_GOAL, null], 0, pick("daily_streak", "GOLD")),
    ).toEqual([
      pick("daily_streak", "GOLD"),
      pick("life_goal", "DIAMOND"),
      null,
    ]);
  });

  it("empties a slot with null", () => {
    expect(withSlot([FIRST_DAY, LIFE_GOAL, STREAK_GOLD], 1, null)).toEqual([
      pick("first_day", "BRONZE"),
      null,
      pick("daily_streak", "GOLD"),
    ]);
  });

  it("sends picks only: the earning date is not part of the request", () => {
    const [first] = withSlot([FIRST_DAY, null, null], 2, null);

    expect(first).toEqual({ badgeKey: "first_day", tier: "BRONZE" });
    expect(first).not.toHaveProperty("earnedAt");
  });

  it("leaves the showcase it was given as it was", () => {
    const showcase = [FIRST_DAY, null, LIFE_GOAL];
    const copy = JSON.parse(JSON.stringify(showcase));

    const result = withSlot(showcase, 0, null);

    expect(showcase).toEqual(copy);
    expect(result).not.toBe(showcase);
  });

  it.each([
    ["a short list", [FIRST_DAY]],
    ["an empty list", []],
    ["a list too long", [FIRST_DAY, null, null, LIFE_GOAL]],
  ])("always gives exactly three slots, also from %s", (_, slots) => {
    const result = withSlot(slots, 1, null);

    expect(result).toHaveLength(SHOWCASE_SLOTS);
    expect(SHOWCASE_SLOTS).toBe(3);
  });
});

describe("earnedBadges", () => {
  const achievement = (
    key: string,
    ...tiers: [BadgeTier, string | null][]
  ): Achievement => ({
    key,
    current: 0,
    tiers: tiers.map(([tier, earnedAt]) => ({
      tier,
      threshold: 1,
      xp: 10,
      earnedAt,
    })),
  });

  it("makes every earned tier an entry of its own and skips the rest", () => {
    const result = earnedBadges([
      achievement(
        "daily_streak",
        ["BRONZE", "2026-10-01T08:00:00.000Z"],
        ["SILVER", "2026-10-20T08:00:00.000Z"],
        ["GOLD", null],
      ),
      achievement("first_week", ["BRONZE", null]),
    ]);

    expect(result).toEqual([
      earned("daily_streak", "BRONZE", "2026-10-01T08:00:00.000Z"),
      earned("daily_streak", "SILVER", "2026-10-20T08:00:00.000Z"),
    ]);
  });

  it("is empty for a new account", () => {
    expect(earnedBadges([achievement("first_day", ["BRONZE", null])])).toEqual(
      [],
    );
  });
});

describe("pickerOptions", () => {
  it("leaves out badges already in the showcase, in whichever slot", () => {
    const all = [FIRST_DAY, LIFE_GOAL, STREAK_GOLD];

    expect(pickerOptions(all, [null, null, LIFE_GOAL])).toEqual([
      STREAK_GOLD,
      FIRST_DAY,
    ]);
    expect(pickerOptions(all, [LIFE_GOAL, FIRST_DAY, STREAK_GOLD])).toEqual([]);
  });

  it("treats two tiers of one badge as two entries", () => {
    const bronze = earned("daily_streak", "BRONZE");

    expect(
      pickerOptions([bronze, STREAK_GOLD], [STREAK_GOLD, null, null]),
    ).toEqual([bronze]);
  });

  it("puts the highest tier first", () => {
    const result = pickerOptions(
      [
        earned("a", "BRONZE"),
        earned("b", "DIAMOND"),
        earned("c", "SILVER"),
        earned("d", "GOLD"),
      ],
      [null, null, null],
    );

    expect(result.map((badge) => badge.tier)).toEqual([
      "DIAMOND",
      "GOLD",
      "SILVER",
      "BRONZE",
    ]);
  });

  it("puts the newest first within one tier", () => {
    const older = earned("a", "GOLD", "2026-09-01T08:00:00.000Z");
    const newest = earned("b", "GOLD", "2026-11-01T08:00:00.000Z");
    const middle = earned("c", "GOLD", "2026-10-01T08:00:00.000Z");

    expect(pickerOptions([older, newest, middle], [null, null, null])).toEqual([
      newest,
      middle,
      older,
    ]);
  });

  it("orders by tier before date", () => {
    const newBronze = earned("a", "BRONZE", "2026-11-09T08:00:00.000Z");
    const oldGold = earned("b", "GOLD", "2026-01-01T08:00:00.000Z");

    expect(pickerOptions([newBronze, oldGold], [null, null, null])).toEqual([
      oldGold,
      newBronze,
    ]);
  });

  it("is empty with nothing earned, and keeps its input in order", () => {
    const input = [FIRST_DAY, LIFE_GOAL];

    expect(pickerOptions([], [null, null, null])).toEqual([]);
    pickerOptions(input, [null, null, null]);
    expect(input).toEqual([FIRST_DAY, LIFE_GOAL]);
  });
});

describe("showcaseView", () => {
  it("lays the slots out in order, empty where there is no badge", () => {
    expect(showcaseView([LIFE_GOAL, null, FIRST_DAY])).toEqual([
      { slot: 0, kind: "badge", ...LIFE_GOAL },
      { slot: 1, kind: "empty" },
      { slot: 2, kind: "badge", ...FIRST_DAY },
    ]);
  });

  it("shows three empty slots for an empty showcase", () => {
    expect(showcaseView([null, null, null])).toEqual([
      { slot: 0, kind: "empty" },
      { slot: 1, kind: "empty" },
      { slot: 2, kind: "empty" },
    ]);
  });

  it("keeps the name key and the tier for the label of a taken slot", () => {
    const [slot] = showcaseView([STREAK_GOLD, null, null]);

    expect(slot).toMatchObject({ badgeKey: "daily_streak", tier: "GOLD" });
  });
});

describe("validatePasswordForm", () => {
  const form = {
    current: "haslo123",
    next: "nowehaslo1",
    repeat: "nowehaslo1",
  };

  it("lets a filled form with matching new passwords through", () => {
    expect(validatePasswordForm(form)).toEqual({});
  });

  it.each(["current", "next", "repeat"] as const)(
    "asks for the %s field when it is empty",
    (field) => {
      expect(validatePasswordForm({ ...form, [field]: "" })).toMatchObject({
        [field]: "profile.password.required",
      });
    },
  );

  it("marks every empty field at once", () => {
    expect(validatePasswordForm({ current: "", next: "", repeat: "" })).toEqual(
      {
        current: "profile.password.required",
        next: "profile.password.required",
        repeat: "profile.password.required",
      },
    );
  });

  it("refuses a repeated password that differs", () => {
    expect(validatePasswordForm({ ...form, repeat: "nowehaslo2" })).toEqual({
      repeat: "profile.password.mismatch",
    });
  });

  it("compares the two only when both are typed", () => {
    expect(validatePasswordForm({ ...form, next: "" })).toEqual({
      next: "profile.password.required",
    });
  });

  it("checks nothing about strength: a short password is the server's call", () => {
    expect(
      validatePasswordForm({ current: "a", next: "b", repeat: "b" }),
    ).toEqual({});
  });
});
