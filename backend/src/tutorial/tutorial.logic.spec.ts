import { TutorialStatus } from '../generated/prisma/client';
import {
  nextTutorialStatus,
  TUTORIAL_MOVES,
  type TutorialAction,
} from './tutorial.logic';

describe('nextTutorialStatus', () => {
  // Every state against every move: the whole table, nothing left out.
  it.each([
    ['NOT_STARTED', 'dismiss', 'DISMISSED'],
    ['NOT_STARTED', 'complete', 'COMPLETED'],
    ['DISMISSED', 'dismiss', 'DISMISSED'], // again: no change, no error
    ['DISMISSED', 'complete', 'COMPLETED'], // skipped, then watched later
    ['COMPLETED', 'dismiss', 'COMPLETED'], // never back from COMPLETED
    ['COMPLETED', 'complete', 'COMPLETED'], // again: no change, no error
  ] as [TutorialStatus, TutorialAction, TutorialStatus][])(
    'from %s, %s leads to %s',
    (current, action, next) => {
      expect(nextTutorialStatus(current, action)).toBe(next);
    },
  );

  it('covers every status of the schema', () => {
    // A status added to the enum later must get a row in the table above.
    expect(Object.values(TutorialStatus).sort()).toEqual(
      ['COMPLETED', 'DISMISSED', 'NOT_STARTED'].sort(),
    );
  });
});

describe('TUTORIAL_MOVES', () => {
  it('never starts a move from COMPLETED', () => {
    for (const move of Object.values(TUTORIAL_MOVES)) {
      expect(move.from).not.toContain('COMPLETED');
    }
  });

  it('never leads back to NOT_STARTED', () => {
    for (const move of Object.values(TUTORIAL_MOVES)) {
      expect(move.to).not.toBe('NOT_STARTED');
    }
  });
});
