import {
  ACTIVITY_LEVEL_MIN,
  BAR_MIN_HEIGHT,
  CELL_GAP,
  CELL_SIZE,
  DAY_LABEL_WIDTH,
  MONTH_LABEL_WIDTH,
} from "@/constants/stats";
import type { ActivityDay, StatsResponse, WeekXp } from "@/types/api";

/*
 * How the statistics screen is drawn, derived from the GET /stats data alone.
 * Pure functions: no React, no fetching. Texts come in through formatters, so
 * none of this depends on the language. "Today" is the server's last day.
 */

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export function activityLevel(completions: number): ActivityLevel {
  return ACTIVITY_LEVEL_MIN.filter((min) => completions >= min)
    .length as ActivityLevel;
}

export type ActivityCell = ActivityDay & { level: ActivityLevel };

/**
 * The calendar's columns, one per ISO week, Monday on top. The server starts
 * the days on a Monday, so every 7 of them make a week; the last `weeks` are
 * kept. Days after today are null: no square is drawn for them.
 */
export function activityGrid(
  days: readonly ActivityDay[],
  weeks: number,
): (ActivityCell | null)[][] {
  const total = Math.ceil(days.length / 7);
  const columns: (ActivityCell | null)[][] = [];
  for (
    let start = Math.max(0, total - weeks) * 7;
    start < days.length;
    start += 7
  ) {
    columns.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = days[start + i];
        return day ? { ...day, level: activityLevel(day.completions) } : null;
      }),
    );
  }
  return columns;
}

export type MonthLabel = { column: number; month: string };

/**
 * A month's name goes over the column holding its first day. It covers
 * `minGap` columns, so a name that would run into the previous one or off the
 * right edge is left out. `month` is 'yyyy-MM'.
 */
export function monthLabels(
  columns: readonly (ActivityCell | null)[][],
  minGap: number,
): MonthLabel[] {
  const labels: MonthLabel[] = [];
  columns.forEach((cells, column) => {
    const first = cells.find((cell) => cell?.date.endsWith("-01"));
    if (!first) return;
    const previous = labels[labels.length - 1];
    if (previous && column - previous.column < minGap) return;
    if (column + minGap > columns.length) return;
    labels.push({ column, month: first.date.slice(0, 7) });
  });
  return labels;
}

/** How many columns a month name covers at this square size. */
export function monthLabelGap(cell: number): number {
  return Math.ceil(MONTH_LABEL_WIDTH / (cell + CELL_GAP));
}

/** The largest square that fits `weeks` columns into `width`, within bounds. */
export function cellSize(width: number, weeks: number): number {
  const fit = Math.floor((width - DAY_LABEL_WIDTH - weeks * CELL_GAP) / weeks);
  return Math.min(CELL_SIZE.max, Math.max(CELL_SIZE.min, fit));
}

export type WeekBar = {
  key: string;
  label: string;
  value: number;
  /** In px; 0 for a week without XP, drawn as the baseline alone. */
  height: number;
  isCurrent: boolean;
};

/** One bar per week, the highest at `maxHeight`, the current week last. */
export function weeklyBars(
  weeks: readonly WeekXp[],
  maxHeight: number,
  formatLabel: (weekStart: string) => string,
): WeekBar[] {
  const max = Math.max(0, ...weeks.map((week) => week.xp));
  return weeks.map((week, i) => ({
    key: week.weekKey,
    label: formatLabel(week.weekStart),
    value: week.xp,
    height:
      week.xp > 0
        ? Math.max(BAR_MIN_HEIGHT, Math.round((week.xp / max) * maxHeight))
        : 0,
    isCurrent: i === weeks.length - 1,
  }));
}

/** Today by the server's clock: the last day it sent. */
export function todayOf(days: readonly ActivityDay[]): string | null {
  return days[days.length - 1]?.date ?? null;
}

/**
 * Midnight UTC of a 'yyyy-MM-dd' day. Format it with timeZone "UTC": a device
 * west of Greenwich would otherwise show the day before.
 */
export function dayKeyDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** An account with nothing to show yet: no completion, no XP, no full day. */
export function isEmptyStats(stats: StatsResponse): boolean {
  return (
    stats.summary.fullDaysTotal === 0 &&
    stats.activity.days.every((day) => day.completions === 0) &&
    stats.weeklyXp.every((week) => week.xp === 0)
  );
}
