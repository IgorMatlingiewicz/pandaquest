/**
 * The local hour from which the evening reminder about daily tasks shows,
 * until midnight. A local hour, not "19 hours after midnight": on the days
 * the clocks change, a day has 23 or 25 hours.
 */
export const EVENING_REMINDER_HOUR = 19;

/**
 * The most reminders GET /reminders returns, and the most keys one
 * POST /reminders/ack takes: whatever the app was shown, it confirms in one
 * call.
 */
export const MAX_REMINDERS = 10;

/**
 * How long a confirmed key is kept. Past that its day or week is long over,
 * so the row can never hide a reminder again; it is removed the next time
 * the user confirms anything. The one exception is a friend request that
 * is still waiting: its key stays, or the reminder would come back.
 */
export const SHOWN_RETENTION_DAYS = 30;
