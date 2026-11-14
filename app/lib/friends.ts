import type { SendFriendRequestResult } from "@/types/api";

/*
 * The friends screens without React: the friend code as people type it, and
 * the time until a declined sender may ask again. Pure functions: no
 * fetching, no translations; the clock comes in as an argument.
 */

/** As FRIEND_CODE_ALPHABET in backend/src/friends/friend-code.ts. */
export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** As FRIEND_CODE_LENGTH there; shown as two groups of 4. */
export const FRIEND_CODE_LENGTH = 8;

const GROUP = FRIEND_CODE_LENGTH / 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The code's characters in what was typed or pasted: capitals, nothing
 * outside the alphabet (no O, 0, I or 1, no spaces or dashes), at most 8.
 * Only for the field: the server normalizes the code itself, and its answer
 * is what counts.
 */
export function friendCodeChars(input: string): string {
  return [...input.toUpperCase()]
    .filter((char) => FRIEND_CODE_ALPHABET.includes(char))
    .slice(0, FRIEND_CODE_LENGTH)
    .join("");
}

/**
 * The code as the app shows it, "ABCD-EFGH", for the code card and for the
 * field while it is typed. The dash comes with the 5th character, not after
 * the 4th, so deleting backwards never gets stuck on it.
 */
export function formatFriendCode(input: string): string {
  const chars = friendCodeChars(input);
  return chars.length > GROUP
    ? `${chars.slice(0, GROUP)}-${chars.slice(GROUP)}`
    : chars;
}

/** Whether the field holds a whole code, so sending makes sense. */
export function isCompleteFriendCode(input: string): boolean {
  return friendCodeChars(input).length === FRIEND_CODE_LENGTH;
}

/** Whole days until `iso`, rounded up (2 hours left is 1 day); 0 once past. */
export function daysUntil(iso: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY_MS));
}

/**
 * The values of "you may ask again in {{count}} days ({{date}})". At least
 * 1 day: this is shown only while the server still refuses, so a device
 * clock running ahead must not make it say "in 0 days".
 */
export function resendValues(
  iso: string,
  now: number,
  language: string,
): { count: number; date: string } {
  return {
    count: Math.max(1, daysUntil(iso, now)),
    date: new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso)),
  };
}

/** What the sender is told after a request went through. */
export function sentRequestKey(result: SendFriendRequestResult): string {
  return result.autoAccepted ? "friends.add.nowFriends" : "friends.add.sent";
}
