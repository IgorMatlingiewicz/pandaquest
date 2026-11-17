/**
 * Where the reminders take "now" from. In the app it is the system clock;
 * the e2e tests put a clock of their own in its place (overrideProvider),
 * so they can ask at 18:59:59 and at 19:00:00 against a real database.
 * Faking the timers instead would also stop the timers the database
 * driver runs on.
 */
export const REMINDERS_CLOCK = Symbol('REMINDERS_CLOCK');

export type RemindersClock = () => Date;

export const systemClock: RemindersClock = () => new Date();
