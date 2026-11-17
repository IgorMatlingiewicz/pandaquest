import type { Reminder } from "@/types/api";

/*
 * The reminders window, decided without React: what it lists, in what
 * order, which keys it confirms, and whether it may show right now. The
 * context (RemindersContext) only feeds these functions and draws the
 * answer.
 */

/** One line of the window; the words come from the translations. */
export type ReminderItem =
  | {
      kind: "daily" | "weekly";
      /** Due tasks still open in the day or the week. */
      remaining: number;
      /** The streak at risk, in days or weeks; null when there is none. */
      streak: number | null;
    }
  | { kind: "friends"; count: number };

export type ReminderView = {
  /** Daily, weekly, friend requests: always this order, each at most once. */
  items: ReminderItem[];
  /** Every key the window stands for, to confirm when it shows. */
  keys: string[];
};

type OfType<T extends Reminder["type"]> = Extract<Reminder, { type: T }>;

const ofType = <T extends Reminder["type"]>(
  reminders: readonly Reminder[],
  type: T,
) => reminders.filter((r): r is OfType<T> => r.type === type);

const CYCLES = [
  ["DAILY_EVENING", "daily"],
  ["WEEKLY_LAST_DAY", "weekly"],
] as const;

/** The reminders this session has not shown yet. */
export function unseenReminders(
  reminders: readonly Reminder[],
  shownKeys: ReadonlySet<string>,
): Reminder[] {
  return reminders.filter((reminder) => !shownKeys.has(reminder.key));
}

/**
 * The window for what the server sent, without what this session already
 * showed; null when nothing is left. Types the app does not know (a newer
 * server) are left out, so they are neither shown nor confirmed.
 *
 * The server sends one entry per new friend request, each with the count
 * of all of them, and the window has one line for them. Requests this
 * session already showed come off that count: here they are not new.
 */
export function reminderView(
  reminders: readonly Reminder[],
  shownKeys: ReadonlySet<string>,
): ReminderView | null {
  const unseen = unseenReminders(reminders, shownKeys);
  const items: ReminderItem[] = [];
  const keys: string[] = [];

  for (const [type, kind] of CYCLES) {
    const entries = ofType(unseen, type);
    if (entries.length === 0) continue;
    const { remaining, atRiskStreak } = entries[0].payload;
    items.push({ kind, remaining, streak: atRiskStreak?.length ?? null });
    keys.push(...entries.map((r) => r.key));
  }

  const invites = ofType(unseen, "FRIEND_INVITE");
  if (invites.length > 0) {
    const serverCount = Math.max(...invites.map((r) => r.payload.count));
    const shownHere =
      ofType(reminders, "FRIEND_INVITE").length - invites.length;
    items.push({
      kind: "friends",
      // Never fewer than the entries actually listed.
      count: Math.max(invites.length, serverCount - shownHere),
    });
    keys.push(...invites.map((r) => r.key));
  }

  return items.length > 0 ? { items, keys } : null;
}

export type ShowInput = {
  /** The "In-app reminders" switch. */
  enabled: boolean;
  /** The logged-in area is on screen, not login or sign-up. */
  authenticated: boolean;
  /** The tutorial, or its farewell, is on screen. */
  tutorialActive: boolean;
  /** A reward window is on screen or waiting in the queue. */
  rewardsPending: boolean;
  reminders: readonly Reminder[];
  shownKeys: ReadonlySet<string>;
};

/**
 * Whether the reminders window may open now. It comes last: the tutorial
 * and the reward windows go first, and the reminders wait until both are
 * gone, so no window ever opens over another.
 */
export function shouldShowReminders(input: ShowInput): boolean {
  return (
    input.enabled &&
    input.authenticated &&
    !input.tutorialActive &&
    !input.rewardsPending &&
    reminderView(input.reminders, input.shownKeys) !== null
  );
}
