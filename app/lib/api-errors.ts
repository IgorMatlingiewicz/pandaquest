import { HttpError } from "@/lib/http-error";

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
  return status === 401 ? "common.sessionExpired" : "stats.loadError";
}

export function profileErrorKey(status: number): string {
  return status === 401 ? "common.sessionExpired" : "profile.loadError";
}

/**
 * PUT /profile/favorite-badges. 404: the badge is no longer among the user's
 * (or never was); 400: the showcase itself was refused. Both mean the screen
 * shows something stale, so the message asks for a refresh.
 */
export function saveShowcaseErrorKey(status: number): string {
  if (status === 400) return "profile.showcase.invalid";
  if (status === 404) return "profile.showcase.notEarned";
  if (status === 401) return "common.sessionExpired";
  return "common.tryAgain";
}

/** Where the password form shows a message: under a field or above them. */
export type PasswordFailure = {
  field: "current" | "next" | "form";
  key: string;
};

/**
 * PATCH /auth/password. A wrong current password is a 403, not a 401: the
 * session is fine, so nothing here may log the user out.
 */
export function changePasswordFailure(error: unknown): PasswordFailure {
  if (!(error instanceof HttpError)) {
    return { field: "form", key: "common.noConnection" };
  }
  switch (error.status) {
    case 403:
      return { field: "current", key: "profile.password.wrongCurrent" };
    case 400:
      return { field: "next", key: "profile.password.tooWeak" };
    case 409:
      return { field: "next", key: "profile.password.sameAsCurrent" };
    case 401:
      return { field: "form", key: "common.sessionExpired" };
    default:
      return {
        field: "form",
        key: error.status >= 500 ? "common.genericError" : "common.tryAgain",
      };
  }
}

export function createStreakGoalErrorKey(status: number): string {
  if (status === 400) return "streaks.invalidName";
  if (status === 409) return "streaks.limitReached";
  return "common.tryAgain";
}
