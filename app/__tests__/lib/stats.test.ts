import {
  BAR_MAX_HEIGHT,
  BAR_MIN_HEIGHT,
  CELL_GAP,
  CELL_SIZE,
  DAY_LABEL_WIDTH,
} from "@/constants/stats";
import {
  activityGrid,
  activityLevel,
  cellSize,
  dayKeyDate,
  isEmptyStats,
  monthLabelGap,
  monthLabels,
  todayOf,
  weeklyBars,
} from "@/lib/stats";
import type { ActivityDay, StatsResponse, WeekXp } from "@/types/api";

const DAY = 24 * 60 * 60 * 1000;

/** `count` days without gaps from `firstKey`, all empty unless overridden. */
function days(
  firstKey: string,
  count: number,
  overrides: Record<string, Partial<ActivityDay>> = {},
): ActivityDay[] {
  const first = Date.parse(`${firstKey}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first + i * DAY).toISOString().slice(0, 10);
    return { date, completions: 0, fullDay: false, ...overrides[date] };
  });
}

const weekday = (key: string) => dayKeyDate(key).getUTCDay();
const dates = (column: (ActivityDay | null)[]) =>
  column.map((cell) => cell?.date ?? null);

// As the server sends it on Wednesday 2026-11-11: from Monday 18 May, 25 full
// weeks and Monday to Wednesday of the current one.
const SERVER_DAYS = days("2026-05-18", 25 * 7 + 3);

describe("activityLevel", () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [20, 4],
  ])("puts %i completions on level %i", (completions, level) => {
    expect(activityLevel(completions)).toBe(level);
  });
});

describe("activityGrid", () => {
  it.each([15, 26])(
    "keeps the last %i weeks, each starting on a Monday",
    (weeks) => {
      const columns = activityGrid(SERVER_DAYS, weeks);

      expect(columns).toHaveLength(weeks);
      expect(columns.every((column) => column.length === 7)).toBe(true);
      expect(columns.every((column) => weekday(column[0]!.date) === 1)).toBe(
        true,
      );
      expect(columns[columns.length - 1][0]?.date).toBe("2026-11-09");
    },
  );

  it("starts the 15-week slice 14 weeks before the current one", () => {
    expect(activityGrid(SERVER_DAYS, 15)[0][0]?.date).toBe("2026-08-03");
  });

  it("shows all 26 weeks the server sent, from its first Monday", () => {
    expect(activityGrid(SERVER_DAYS, 26)[0][0]?.date).toBe("2026-05-18");
  });

  it("leaves the days after today out of the current week", () => {
    const current = activityGrid(SERVER_DAYS, 15).at(-1)!;

    expect(dates(current)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      null,
      null,
      null,
      null,
    ]);
  });

  it("fills the current week when today is a Sunday", () => {
    const current = activityGrid(days("2026-05-18", 26 * 7), 15).at(-1)!;

    expect(current.every((cell) => cell !== null)).toBe(true);
    expect(current[6]?.date).toBe("2026-11-15");
  });

  it("runs across the turn of the year", () => {
    const columns = activityGrid(days("2026-07-13", 25 * 7 + 1), 15);
    const all = columns.flat().map((cell) => cell?.date);

    expect(all).toContain("2026-12-31");
    expect(all).toContain("2027-01-01");
    expect(columns.at(-1)?.[0]?.date).toBe("2027-01-04");
  });

  it("keeps the counts and adds the level of each day", () => {
    const columns = activityGrid(
      days("2026-05-18", 25 * 7 + 3, {
        "2026-11-10": { completions: 5, fullDay: true },
      }),
      15,
    );

    expect(columns.at(-1)?.[1]).toEqual({
      date: "2026-11-10",
      completions: 5,
      fullDay: true,
      level: 3,
    });
  });

  it("shows fewer columns when the server sent fewer weeks", () => {
    expect(activityGrid(days("2026-11-02", 10), 15)).toHaveLength(2);
  });
});

describe("monthLabels", () => {
  const columns = activityGrid(SERVER_DAYS, 15);

  it("puts each month over the column holding its first day", () => {
    const labels = monthLabels(columns, 1);

    expect(labels).toEqual([
      { column: 4, month: "2026-09" }, // week of Monday 31 August
      { column: 8, month: "2026-10" }, // week of Monday 28 September
      { column: 12, month: "2026-11" }, // week of Monday 26 October
    ]);
    for (const { column, month } of labels) {
      expect(columns[column].some((cell) => cell?.date === `${month}-01`)).toBe(
        true,
      );
    }
  });

  it("leaves out a month that would run into the one before", () => {
    // Over 26 weeks the months start in columns 2, 6, 10, 15, 19 and 23.
    const labels = monthLabels(activityGrid(SERVER_DAYS, 26), 5);

    // July (4 after June) and October (4 after September) would overlap;
    // November would run off the edge.
    expect(labels).toEqual([
      { column: 2, month: "2026-06" },
      { column: 10, month: "2026-08" },
      { column: 15, month: "2026-09" },
    ]);
  });

  it("leaves out a month that would run off the right edge", () => {
    expect(monthLabels(columns, 4).map((label) => label.month)).toEqual([
      "2026-09",
      "2026-10",
    ]);
  });

  it("tells December and January of the next year apart", () => {
    const labels = monthLabels(
      activityGrid(days("2026-07-13", 25 * 7 + 1), 15),
      1,
    );

    expect(labels.map((label) => label.month).slice(-2)).toEqual([
      "2026-12",
      "2027-01",
    ]);
  });
});

describe("monthLabelGap", () => {
  it("is the number of columns a month name covers", () => {
    expect(monthLabelGap(10)).toBe(3); // 28 px over 13 px columns
    expect(monthLabelGap(18)).toBe(2); // 28 px over 21 px columns
  });
});

describe("cellSize", () => {
  it("fills the width with the given number of weeks", () => {
    const width = DAY_LABEL_WIDTH + 15 * (14 + CELL_GAP);

    expect(cellSize(width, 15)).toBe(14);
  });

  it("rounds down, so the squares never overflow", () => {
    const width = DAY_LABEL_WIDTH + 15 * (14 + CELL_GAP) + 10;

    expect(cellSize(width, 15)).toBe(14);
  });

  it("stays within its bounds", () => {
    expect(cellSize(2000, 15)).toBe(CELL_SIZE.max);
    expect(cellSize(200, 26)).toBe(CELL_SIZE.min);
  });
});

describe("weeklyBars", () => {
  const weeks = (...xp: number[]): WeekXp[] =>
    xp.map((value, i) => ({
      weekKey: `2026-W${String(39 + i).padStart(2, "0")}`,
      weekStart: `2026-09-${String(21 + i).padStart(2, "0")}`,
      xp: value,
    }));
  const label = (weekStart: string) => `od ${weekStart}`;

  it("makes the highest week full height and the others in proportion", () => {
    const bars = weeklyBars(weeks(0, 50, 100, 200), BAR_MAX_HEIGHT, label);

    expect(bars.map((bar) => bar.height)).toEqual([0, 35, 70, BAR_MAX_HEIGHT]);
  });

  it("gives a small week the minimum height instead of nothing", () => {
    const bars = weeklyBars(weeks(1, 1000), BAR_MAX_HEIGHT, label);

    expect(bars[0].height).toBe(BAR_MIN_HEIGHT);
  });

  it("leaves every bar at zero when there is no XP at all", () => {
    const bars = weeklyBars(weeks(0, 0, 0), BAR_MAX_HEIGHT, label);

    expect(bars.every((bar) => bar.height === 0)).toBe(true);
  });

  it("marks the last week as the current one", () => {
    const bars = weeklyBars(weeks(10, 20, 30), BAR_MAX_HEIGHT, label);

    expect(bars.map((bar) => bar.isCurrent)).toEqual([false, false, true]);
  });

  it("keeps the week key, the value and the label", () => {
    const [bar] = weeklyBars(weeks(240), BAR_MAX_HEIGHT, label);

    expect(bar).toEqual({
      key: "2026-W39",
      label: "od 2026-09-21",
      value: 240,
      height: BAR_MAX_HEIGHT,
      isCurrent: true,
    });
  });
});

describe("todayOf", () => {
  it("is the last day the server sent, whatever the device clock says", () => {
    jest.useFakeTimers({ now: new Date("2030-01-01T12:00:00Z") });

    expect(todayOf(SERVER_DAYS)).toBe("2026-11-11");

    jest.useRealTimers();
  });

  it("is null without any days", () => {
    expect(todayOf([])).toBeNull();
  });
});

describe("dayKeyDate", () => {
  it("is midnight UTC of that date, so a formatter in UTC shows the same day", () => {
    const date = dayKeyDate("2026-11-07");

    expect(date.toISOString()).toBe("2026-11-07T00:00:00.000Z");
    expect(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        day: "numeric",
      }).format(date),
    ).toBe("7");
  });
});

describe("isEmptyStats", () => {
  const stats = (overrides: Partial<StatsResponse> = {}): StatsResponse => ({
    serverNow: "2026-11-11T11:00:00.000Z",
    timezone: "Europe/Warsaw",
    activity: { days: SERVER_DAYS },
    weeklyXp: weeks0(),
    summary: {
      fullDaysTotal: 0,
      currentStreak: 0,
      longestStreak: 0,
      xpThisMonth: 0,
      completionsThisMonth: 0,
    },
    ...overrides,
  });
  function weeks0(): WeekXp[] {
    return Array.from({ length: 8 }, (_, i) => ({
      weekKey: `2026-W${39 + i}`,
      weekStart: "2026-09-21",
      xp: 0,
    }));
  }

  it("is true for an account with nothing in it", () => {
    expect(isEmptyStats(stats())).toBe(true);
  });

  it("is false once there is a completion", () => {
    expect(
      isEmptyStats(
        stats({
          activity: {
            days: days("2026-05-18", 25 * 7 + 3, {
              "2026-11-11": { completions: 1 },
            }),
          },
        }),
      ),
    ).toBe(false);
  });

  it("is false with XP alone, e.g. from a streak goal", () => {
    const weeklyXp = weeks0();
    weeklyXp[7].xp = 15;

    expect(isEmptyStats(stats({ weeklyXp }))).toBe(false);
  });

  it("is false with full days older than the calendar", () => {
    expect(
      isEmptyStats(
        stats({
          summary: { ...stats().summary, fullDaysTotal: 3, longestStreak: 3 },
        }),
      ),
    ).toBe(false);
  });
});
