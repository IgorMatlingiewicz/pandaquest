import { HttpException, HttpStatus } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';

/*
 * Every refusal of the friends module, in one table. The answer carries a
 * `code` next to the usual statusCode, error and message: five different
 * refusals share 409 here, so the status alone cannot tell the app which
 * text to show. Elsewhere in the API the status is enough and there is no
 * code; this is the one module that needs it. The message is for whoever
 * reads the logs; the app translates the code.
 */
export const FRIEND_ERRORS = {
  // One answer for every miss, so it does not tell which codes exist.
  INVALID_FRIEND_CODE: {
    status: HttpStatus.NOT_FOUND,
    message: 'Nieprawidłowy kod znajomego',
  },
  CANNOT_ADD_SELF: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Nie można zaprosić samego siebie',
  },
  ALREADY_FRIENDS: {
    status: HttpStatus.CONFLICT,
    message: 'Jesteście już znajomymi',
  },
  REQUEST_ALREADY_SENT: {
    status: HttpStatus.CONFLICT,
    message: 'Zaproszenie już wysłane',
  },
  FRIEND_REQUEST_COOLDOWN: {
    status: HttpStatus.CONFLICT,
    message: 'Ponowne zaproszenie będzie możliwe później',
  },
  TOO_MANY_PENDING_REQUESTS: {
    status: HttpStatus.CONFLICT,
    message: 'Za dużo oczekujących zaproszeń',
  },
  FRIEND_LIMIT_REACHED: {
    status: HttpStatus.CONFLICT,
    message: 'Osiągnięto limit znajomych',
  },
  // Someone else's request, or one no longer waiting: the same answer as
  // none at all, so nobody learns of other people's requests (404, not 403).
  REQUEST_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Zaproszenie nie znalezione',
  },
  // Not a friend of the user, or no such friendship: the same answer either
  // way, so a stranger learns nothing about anyone (OWASP API1, BOLA).
  FRIEND_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Znajomy nie znaleziony',
  },
} as const satisfies Record<string, { status: HttpStatus; message: string }>;

export type FriendErrorCode = keyof typeof FRIEND_ERRORS;

/**
 * The exception for a refusal: Nest's usual body plus `code`, and any extra
 * fields the client needs (e.g. availableAt for a cooldown). The extras
 * cannot overwrite the code or the status.
 */
export function friendError(
  code: FriendErrorCode,
  details: Record<string, unknown> = {},
): HttpException {
  const { status, message } = FRIEND_ERRORS[code];
  return new HttpException(
    {
      ...details,
      statusCode: status,
      error: STATUS_CODES[status],
      code,
      message,
    },
    status,
  );
}
