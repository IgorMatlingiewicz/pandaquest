import type { TutorialStatus } from '../generated/prisma/client';

export type TutorialAction = 'dismiss' | 'complete';

type Move = { from: readonly TutorialStatus[]; to: TutorialStatus };

/*
 * The only moves of the tutorial status: each names the states it may start
 * from and the state it leads to.
 *
 * - dismiss: NOT_STARTED → DISMISSED ("skip" on the first screen).
 * - complete: NOT_STARTED or DISMISSED → COMPLETED (a skipped tutorial can
 *   still be watched to the end later, from the settings).
 *
 * Nothing ever leaves COMPLETED: the status says what the user has done,
 * and a finished tutorial stays finished. Watching it again from the
 * settings is the app's own business and does not touch the status.
 *
 * From any state not listed, a move changes nothing, and that is no error:
 * the app can send a move twice (a double tap, a retry after a lost answer)
 * and gets the same result.
 *
 * The service writes with this table as the condition (UPDATE ... WHERE
 * status IN from), so the database itself refuses a move back, also when
 * two requests come at once.
 */
export const TUTORIAL_MOVES: Record<TutorialAction, Move> = {
  dismiss: { from: ['NOT_STARTED'], to: 'DISMISSED' },
  complete: { from: ['NOT_STARTED', 'DISMISSED'], to: 'COMPLETED' },
};

/** The status after `action`, as the service's conditional write leaves it. */
export function nextTutorialStatus(
  current: TutorialStatus,
  action: TutorialAction,
): TutorialStatus {
  const move = TUTORIAL_MOVES[action];
  return move.from.includes(current) ? move.to : current;
}
