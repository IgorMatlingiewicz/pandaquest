import { RESEND_COOLDOWN_MS } from './friends.config';
import { personView, requestView } from './friend-views';

const CREATED = new Date('2026-11-10T10:00:00.000Z');
const RESPONDED = new Date('2026-11-11T10:00:00.000Z');

// A row as Prisma could return it with more than asked for: none of the
// extras may reach the answer.
const userWithEverything = {
  username: 'panda',
  level: 7,
  email: 'panda@example.com',
  passwordHash: 'secret',
  xpTotal: 4200,
  friendCode: 'ABCDEFGH',
  timezone: 'Europe/Warsaw',
};

describe('personView', () => {
  it('shows exactly the display name and the level', () => {
    expect(personView(userWithEverything)).toEqual({
      username: 'panda',
      level: 7,
    });
  });
});

describe('requestView', () => {
  const row = {
    id: 'request-1',
    status: 'PENDING' as const,
    createdAt: CREATED,
    respondedAt: null,
    requesterId: 'user-a',
    addresseeId: 'user-b',
  };

  it('shows exactly the id, the other person, the status and the date', () => {
    const view = requestView(row, userWithEverything);

    expect(view).toEqual({
      id: 'request-1',
      user: { username: 'panda', level: 7 },
      status: 'PENDING',
      createdAt: CREATED,
    });
    expect(Object.keys(view).sort()).toEqual(
      ['createdAt', 'id', 'status', 'user'].sort(),
    );
  });

  it('tells, for a declined request, when its sender may ask again', () => {
    const view = requestView(
      { ...row, status: 'DECLINED', respondedAt: RESPONDED },
      userWithEverything,
    );

    expect(view.resendAvailableAt).toEqual(
      new Date(RESPONDED.getTime() + RESEND_COOLDOWN_MS),
    );
    expect(Object.keys(view).sort()).toEqual(
      ['createdAt', 'id', 'resendAvailableAt', 'status', 'user'].sort(),
    );
  });

  it('says nothing of the answer time for other statuses', () => {
    const view = requestView(
      { ...row, status: 'ACCEPTED', respondedAt: RESPONDED },
      userWithEverything,
    );

    expect(view).not.toHaveProperty('resendAvailableAt');
    expect(view).not.toHaveProperty('respondedAt');
  });
});
