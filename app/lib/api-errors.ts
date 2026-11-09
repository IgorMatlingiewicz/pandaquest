/*
 * What a refused request means, as a translation key. The server decides
 * what happened and says so with a status code; the wording belongs to the
 * app, so that every message follows the user's language. The server's own
 * message is never shown: it comes in one fixed language.
 */

/**
 * 400 (malformed input) and 401 (wrong email or password) are the user's to
 * correct; anything else is a failure on our side, and blaming the password
 * would send them the wrong way, e.g. when the database is down.
 */
export function loginErrorKey(status: number): string {
  return status === 400 || status === 401
    ? "auth.login.invalidCredentials"
    : "common.genericError";
}

export function registerErrorKey(status: number): string {
  if (status === 400) return "auth.register.invalidData";
  if (status === 409) return "auth.register.emailTaken";
  return status >= 500 ? "common.genericError" : "auth.register.failed";
}

export function deleteCategoryErrorKey(status: number): string {
  if (status === 403) return "tasks.deleteCategoryForbidden";
  if (status === 409) return "tasks.deleteCategoryNotEmpty";
  return "common.tryAgain";
}

/** 401: the stored session is no longer valid, so retrying will not help. */
export function statsErrorKey(status: number): string {
  return status === 401 ? "stats.sessionExpired" : "stats.loadError";
}

export function createStreakGoalErrorKey(status: number): string {
  if (status === 400) return "streaks.invalidName";
  if (status === 409) return "streaks.limitReached";
  return "common.tryAgain";
}
