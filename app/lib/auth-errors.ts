/**
 * The translation key for a refused sign-in. 400 (malformed input) and 401
 * (wrong email or password) are the user's to correct; anything else is a
 * failure on our side, and blaming the password would send them the wrong
 * way, e.g. when the database is down and the server answers 500.
 */
export function loginErrorKey(status: number): string {
  return status === 400 || status === 401
    ? "auth.login.invalidCredentials"
    : "common.genericError";
}
