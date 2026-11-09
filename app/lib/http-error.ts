/** The server answered and refused; fetch itself rejects with no answer. */
export class HttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
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
