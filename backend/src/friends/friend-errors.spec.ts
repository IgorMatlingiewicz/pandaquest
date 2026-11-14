import {
  FRIEND_ERRORS,
  friendError,
  type FriendErrorCode,
} from './friend-errors';

describe('friendError', () => {
  it.each<[FriendErrorCode, number, string]>([
    ['INVALID_FRIEND_CODE', 404, 'Not Found'],
    ['CANNOT_ADD_SELF', 400, 'Bad Request'],
    ['ALREADY_FRIENDS', 409, 'Conflict'],
    ['REQUEST_ALREADY_SENT', 409, 'Conflict'],
    ['FRIEND_REQUEST_COOLDOWN', 409, 'Conflict'],
    ['TOO_MANY_PENDING_REQUESTS', 409, 'Conflict'],
    ['FRIEND_LIMIT_REACHED', 409, 'Conflict'],
    ['REQUEST_NOT_FOUND', 404, 'Not Found'],
    ['FRIEND_NOT_FOUND', 404, 'Not Found'],
  ])('answers %s with %i', (code, status, error) => {
    const exception = friendError(code);

    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toEqual({
      statusCode: status,
      error,
      code,
      message: FRIEND_ERRORS[code].message,
    });
  });

  it('covers every code in the table, each with a message', () => {
    for (const [code, { message }] of Object.entries(FRIEND_ERRORS)) {
      expect(friendError(code as FriendErrorCode).getResponse()).toMatchObject({
        code,
      });
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('adds the extra fields the client needs', () => {
    const availableAt = '2026-11-20T10:00:00.000Z';

    expect(
      friendError('FRIEND_REQUEST_COOLDOWN', { availableAt }).getResponse(),
    ).toMatchObject({ code: 'FRIEND_REQUEST_COOLDOWN', availableAt });
  });

  it('never lets the extras overwrite the code or the status', () => {
    const response = friendError('ALREADY_FRIENDS', {
      code: 'SOMETHING_ELSE',
      statusCode: 200,
    }).getResponse();

    expect(response).toMatchObject({
      code: 'ALREADY_FRIENDS',
      statusCode: 409,
    });
  });
});
