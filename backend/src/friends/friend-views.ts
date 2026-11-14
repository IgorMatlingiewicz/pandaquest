import type { FriendshipStatus } from '../generated/prisma/client';
import { resendAvailableAt } from './friend-requests.logic';

/*
 * What the friends endpoints answer, built field by field from an explicit
 * list (privacy by default, GDPR art. 25(2)): never a database row passed
 * on, so a column added to users later cannot leak by itself. Of another
 * user only the display name and the level are ever shown here.
 */

/** The other side of a request, as anyone involved may see them. */
export type PersonView = { username: string; level: number };

export type RequestView = {
  id: string;
  user: PersonView;
  status: FriendshipStatus;
  createdAt: Date;
  /** Only for a declined request: when its sender may ask again. */
  resendAvailableAt?: Date;
};

export function personView(user: PersonView): PersonView {
  return { username: user.username, level: user.level };
}

export function requestView(
  row: {
    id: string;
    status: FriendshipStatus;
    createdAt: Date;
    respondedAt: Date | null;
  },
  other: PersonView,
): RequestView {
  const view: RequestView = {
    id: row.id,
    user: personView(other),
    status: row.status,
    createdAt: row.createdAt,
  };
  if (row.status === 'DECLINED' && row.respondedAt) {
    view.resendAvailableAt = resendAvailableAt(row.respondedAt);
  }
  return view;
}
