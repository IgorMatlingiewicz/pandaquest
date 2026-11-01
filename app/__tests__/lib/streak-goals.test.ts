import {
  clockOffset,
  crossedFullDay,
  elapsedParts,
  fullDaysAt,
  pageAt,
  randomIndex,
  recordDays,
  tierProgress,
  twoDigits,
} from "@/lib/streak-goals";
import type { StreakGoalTier } from "@/types/api";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const STARTED_AT = "2026-11-01T10:00:00.000Z";
const START = Date.parse(STARTED_AT);

const TIERS: StreakGoalTier[] = [
  { tier: "BRONZE", threshold: 7 },
  { tier: "SILVER", threshold: 30 },
  { tier: "GOLD", threshold: 100 },
  { tier: "DIAMOND", threshold: 365 },
];

describe("clockOffset", () => {
  it("is what has to be added to the device clock to read the server's", () => {
    const deviceNow = START + 5 * MINUTE;

    expect(clockOffset(STARTED_AT, deviceNow)).toBe(-5 * MINUTE);
  });

  it("is zero when both clocks agree", () => {
    expect(clockOffset(STARTED_AT, START)).toBe(0);
  });

  it("is positive when the device clock is behind", () => {
    expect(clockOffset(STARTED_AT, START - HOUR)).toBe(HOUR);
  });
});

describe("elapsedParts", () => {
  it("splits the time since the start into days, hours, minutes and seconds", () => {
    const now = START + 3 * DAY + 4 * HOUR + 5 * MINUTE + 6 * SECOND;

    expect(elapsedParts(STARTED_AT, now)).toEqual({
      days: 3,
      hours: 4,
      minutes: 5,
      seconds: 6,
    });
  });

  it("counts only finished seconds", () => {
    expect(elapsedParts(STARTED_AT, START + 999).seconds).toBe(0);
    expect(elapsedParts(STARTED_AT, START + 1000).seconds).toBe(1);
  });

  it("rolls every unit over at its limit", () => {
    const justBeforeDay = START + DAY - SECOND;

    expect(elapsedParts(STARTED_AT, justBeforeDay)).toEqual({
      days: 0,
      hours: 23,
      minutes: 59,
      seconds: 59,
    });
    expect(elapsedParts(STARTED_AT, START + DAY)).toEqual({
      days: 1,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it("shows zero, not a negative time, for a start slightly ahead of now", () => {
    expect(elapsedParts(STARTED_AT, START - 300)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});

describe("fullDaysAt", () => {
  it("counts a day only once all of its 24 hours have passed", () => {
    expect(fullDaysAt(STARTED_AT, START + DAY - 1)).toBe(0);
    expect(fullDaysAt(STARTED_AT, START + DAY)).toBe(1);
  });

  it("is zero for a start slightly ahead of now", () => {
    expect(fullDaysAt(STARTED_AT, START - 300)).toBe(0);
  });
});

describe("crossedFullDay", () => {
  const goals = [{ startedAt: STARTED_AT }];

  it("is true when a full day ended between the two moments", () => {
    expect(crossedFullDay(goals, START + DAY - 1, START + DAY)).toBe(true);
  });

  it("is false while the same day goes on", () => {
    expect(crossedFullDay(goals, START + DAY, START + DAY + SECOND)).toBe(
      false,
    );
  });

  it("is true for a jump over many days, e.g. back from the background", () => {
    expect(crossedFullDay(goals, START + HOUR, START + 5 * DAY)).toBe(true);
  });

  it("is true when any one of the goals crossed a day", () => {
    const later = new Date(START + 6 * HOUR).toISOString();
    const both = [{ startedAt: later }, { startedAt: STARTED_AT }];

    expect(crossedFullDay(both, START + DAY - 1, START + DAY)).toBe(true);
  });

  it("is false without goals", () => {
    expect(crossedFullDay([], START, START + 5 * DAY)).toBe(false);
  });
});

describe("tierProgress", () => {
  it("starts with nothing reached and heads for the first tier", () => {
    expect(tierProgress(0, TIERS)).toEqual({
      reached: 0,
      next: TIERS[0],
      ratio: 0,
    });
  });

  it("measures the way to the next tier from zero days", () => {
    expect(tierProgress(15, TIERS)).toEqual({
      reached: 1,
      next: TIERS[1],
      ratio: 0.5,
    });
  });

  it("counts a tier as reached on the very day of its threshold", () => {
    expect(tierProgress(6, TIERS).reached).toBe(0);
    expect(tierProgress(7, TIERS).reached).toBe(1);
    expect(tierProgress(7, TIERS).next).toBe(TIERS[1]);
  });

  it("fills three tiers after 150 days", () => {
    expect(tierProgress(150, TIERS).reached).toBe(3);
  });

  it("has no next tier and a full bar once all are reached", () => {
    expect(tierProgress(365, TIERS)).toEqual({
      reached: 4,
      next: null,
      ratio: 1,
    });
  });
});

describe("recordDays", () => {
  const goal = (recordSec: number) => ({ startedAt: STARTED_AT, recordSec });
  const DAY_SEC = 24 * 60 * 60;

  it("is the record the server sent while the attempt is shorter", () => {
    expect(recordDays(goal(12 * DAY_SEC), START + 3 * DAY)).toBe(12);
  });

  it("follows the running attempt once it is longer", () => {
    expect(recordDays(goal(12 * DAY_SEC), START + 20 * DAY)).toBe(20);
  });

  it("counts only full days of the record", () => {
    expect(recordDays(goal(DAY_SEC - 1), START)).toBe(0);
    expect(recordDays(goal(DAY_SEC), START)).toBe(1);
  });
});

describe("twoDigits", () => {
  it("pads one digit and leaves two as they are", () => {
    expect(twoDigits(7)).toBe("07");
    expect(twoDigits(0)).toBe("00");
    expect(twoDigits(41)).toBe("41");
  });
});

describe("pageAt", () => {
  it("is the page closest to the scroll position", () => {
    expect(pageAt(0, 400, 3)).toBe(0);
    expect(pageAt(199, 400, 3)).toBe(0);
    expect(pageAt(200, 400, 3)).toBe(1);
    expect(pageAt(800, 400, 3)).toBe(2);
  });

  it("stays in range when the list bounces past either end", () => {
    expect(pageAt(-30, 400, 3)).toBe(0);
    expect(pageAt(900, 400, 3)).toBe(2);
  });

  it("is the first page before the width is known", () => {
    expect(pageAt(100, 0, 3)).toBe(0);
  });
});

describe("randomIndex", () => {
  it("covers the whole range and stays inside it", () => {
    expect(randomIndex(8, () => 0)).toBe(0);
    expect(randomIndex(8, () => 0.5)).toBe(4);
    expect(randomIndex(8, () => 0.999)).toBe(7);
  });
});
