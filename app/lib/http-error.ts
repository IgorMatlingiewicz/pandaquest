/**
 * The server answered and refused; fetch itself rejects with no answer.
 *
 * Most of the API says what happened with the status alone. The friends
 * module also sends a `code`, as several of its refusals share 409, and
 * some codes carry a field the app shows (availableAt: when a declined
 * sender may ask again). Both stay undefined for the other modules.
 */
export class HttpError extends Error {
  status: number;
  code?: string;
  availableAt?: string;

  constructor(status: number, body?: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    if (typeof body === "object" && body !== null) {
      const { code, availableAt } = body as Record<string, unknown>;
      if (typeof code === "string") this.code = code;
      if (typeof availableAt === "string") this.availableAt = availableAt;
    }
  }

  /**
   * The error for a refused response, with what its body says. A body that
   * is not JSON (a proxy's HTML page, an empty 502) leaves only the status.
   */
  static async from(response: Response): Promise<HttpError> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return new HttpError(response.status, body);
  }
}

/**
 * What a failed request means, as a translation key: `keyOf` decides for a
 * refusal, and no answer at all is a connection problem.
 */
export function failureKey(
  error: unknown,
  keyOf: (status: number) => string = () => "common.tryAgain",
): string {
  return error instanceof HttpError
    ? keyOf(error.status)
    : "common.noConnection";
}
