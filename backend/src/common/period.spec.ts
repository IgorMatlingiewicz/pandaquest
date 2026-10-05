import { getPeriodEnd, getPeriodKey } from './period';

const WARSAW = 'Europe/Warsaw';
const NEW_YORK = 'America/New_York';

describe('getPeriodKey', () => {
  describe('non-cyclic types', () => {
    const now = new Date('2026-10-05T12:00:00Z');

    it('returns null for LIFE', () => {
      expect(getPeriodKey('LIFE', now, WARSAW)).toBeNull();
    });

    it('returns null for SIDE_QUEST', () => {
      expect(getPeriodKey('SIDE_QUEST', now, WARSAW)).toBeNull();
    });
  });

  describe('DAILY', () => {
    it('formats the date as yyyy-MM-dd in the given timezone', () => {
      const now = new Date('2026-10-05T12:00:00Z');
      expect(getPeriodKey('DAILY', now, WARSAW)).toBe('2026-10-05');
    });

    it('changes at local midnight, not UTC midnight', () => {
      // Warsaw is UTC+2 in October: local midnight is 22:00 UTC.
      const beforeMidnight = new Date('2026-10-05T21:59:59Z');
      const atMidnight = new Date('2026-10-05T22:00:00Z');

      expect(getPeriodKey('DAILY', beforeMidnight, WARSAW)).toBe('2026-10-05');
      expect(getPeriodKey('DAILY', atMidnight, WARSAW)).toBe('2026-10-06');
    });

    it('gives different keys for the same instant in Warsaw and New York', () => {
      // 02:00 in Warsaw (Oct 6), 20:00 in New York (Oct 5).
      const now = new Date('2026-10-06T00:00:00Z');

      expect(getPeriodKey('DAILY', now, WARSAW)).toBe('2026-10-06');
      expect(getPeriodKey('DAILY', now, NEW_YORK)).toBe('2026-10-05');
    });
  });

  describe('WEEKLY', () => {
    it('changes between Sunday 23:59 and Monday 00:00 in Warsaw', () => {
      // Sunday 2026-10-04 23:59 and Monday 2026-10-05 00:00, Warsaw (UTC+2).
      const sundayNight = new Date('2026-10-04T21:59:00Z');
      const mondayMidnight = new Date('2026-10-04T22:00:00Z');

      expect(getPeriodKey('WEEKLY', sundayNight, WARSAW)).toBe('2026-W40');
      expect(getPeriodKey('WEEKLY', mondayMidnight, WARSAW)).toBe('2026-W41');
    });

    it('stays the same from Monday to Sunday', () => {
      const monday = new Date('2026-10-05T10:00:00Z');
      const sunday = new Date('2026-10-11T10:00:00Z');

      expect(getPeriodKey('WEEKLY', monday, WARSAW)).toBe('2026-W41');
      expect(getPeriodKey('WEEKLY', sunday, WARSAW)).toBe('2026-W41');
    });

    it('gives different keys for the same instant in Warsaw and New York', () => {
      // Monday 00:30 in Warsaw, still Sunday 18:30 in New York.
      const now = new Date('2026-10-04T22:30:00Z');

      expect(getPeriodKey('WEEKLY', now, WARSAW)).toBe('2026-W41');
      expect(getPeriodKey('WEEKLY', now, NEW_YORK)).toBe('2026-W40');
    });

    it('zero-pads single-digit week numbers', () => {
      const now = new Date('2026-01-07T12:00:00Z');
      expect(getPeriodKey('WEEKLY', now, WARSAW)).toBe('2026-W02');
    });
  });

  describe('year boundary', () => {
    // 2026-12-31 is a Thursday, so ISO week 53 of 2026 runs
    // from Mon 2026-12-28 to Sun 2027-01-03.
    const newYearsEve = new Date('2026-12-31T12:00:00Z');
    const newYearsDay = new Date('2027-01-01T12:00:00Z');

    it('keeps Jan 1st 2027 in ISO week 2026-W53', () => {
      expect(getPeriodKey('WEEKLY', newYearsEve, WARSAW)).toBe('2026-W53');
      expect(getPeriodKey('WEEKLY', newYearsDay, WARSAW)).toBe('2026-W53');
    });

    it('starts 2027-W01 on Monday Jan 4th', () => {
      const sunday = new Date('2027-01-03T22:59:00Z'); // 23:59 Warsaw (UTC+1)
      const monday = new Date('2027-01-03T23:00:00Z'); // 00:00 Warsaw

      expect(getPeriodKey('WEEKLY', sunday, WARSAW)).toBe('2026-W53');
      expect(getPeriodKey('WEEKLY', monday, WARSAW)).toBe('2027-W01');
    });

    it('still rolls the daily key over to the new calendar year', () => {
      expect(getPeriodKey('DAILY', newYearsEve, WARSAW)).toBe('2026-12-31');
      expect(getPeriodKey('DAILY', newYearsDay, WARSAW)).toBe('2027-01-01');
    });

    it('assigns late December to week 1 of the next ISO year', () => {
      // Monday 2025-12-29 belongs to 2026-W01.
      const now = new Date('2025-12-29T12:00:00Z');
      expect(getPeriodKey('WEEKLY', now, WARSAW)).toBe('2026-W01');
    });
  });

  describe('DST in Europe/Warsaw', () => {
    // Clocks go forward on Sunday 2026-03-29 at 02:00 -> 03:00 (UTC+1 -> UTC+2).
    it('starts the DST Sunday at local midnight (still UTC+1)', () => {
      const saturdayNight = new Date('2026-03-28T22:59:59Z'); // 23:59:59 Sat
      const sundayMidnight = new Date('2026-03-28T23:00:00Z'); // 00:00 Sun

      expect(getPeriodKey('DAILY', saturdayNight, WARSAW)).toBe('2026-03-28');
      expect(getPeriodKey('DAILY', sundayMidnight, WARSAW)).toBe('2026-03-29');
    });

    it('ends the 23-hour DST Sunday at local midnight (now UTC+2)', () => {
      const sundayNight = new Date('2026-03-29T21:59:59Z'); // 23:59:59 Sun
      const mondayMidnight = new Date('2026-03-29T22:00:00Z'); // 00:00 Mon

      expect(getPeriodKey('DAILY', sundayNight, WARSAW)).toBe('2026-03-29');
      expect(getPeriodKey('DAILY', mondayMidnight, WARSAW)).toBe('2026-03-30');
    });

    it('switches the weekly key at Monday local midnight after the change', () => {
      const sundayNight = new Date('2026-03-29T21:59:59Z');
      const mondayMidnight = new Date('2026-03-29T22:00:00Z');

      expect(getPeriodKey('WEEKLY', sundayNight, WARSAW)).toBe('2026-W13');
      expect(getPeriodKey('WEEKLY', mondayMidnight, WARSAW)).toBe('2026-W14');
    });

    it('handles the 25-hour Sunday when clocks go back in October', () => {
      // 2026-10-25: 03:00 -> 02:00 (UTC+2 -> UTC+1).
      const sundayMidnight = new Date('2026-10-24T22:00:00Z'); // 00:00 Sun
      const sundayNight = new Date('2026-10-25T22:59:59Z'); // 23:59:59 Sun
      const mondayMidnight = new Date('2026-10-25T23:00:00Z'); // 00:00 Mon

      expect(getPeriodKey('DAILY', sundayMidnight, WARSAW)).toBe('2026-10-25');
      expect(getPeriodKey('DAILY', sundayNight, WARSAW)).toBe('2026-10-25');
      expect(getPeriodKey('DAILY', mondayMidnight, WARSAW)).toBe('2026-10-26');
    });
  });
});

describe('getPeriodEnd', () => {
  const iso = (d: Date | null) => d?.toISOString();

  it('returns null for LIFE and SIDE_QUEST', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    expect(getPeriodEnd('LIFE', now, WARSAW)).toBeNull();
    expect(getPeriodEnd('SIDE_QUEST', now, WARSAW)).toBeNull();
  });

  it('DAILY ends at the next local midnight', () => {
    // 14:00 in Warsaw (UTC+2) -> midnight is 22:00 UTC.
    const now = new Date('2026-10-05T12:00:00Z');
    expect(iso(getPeriodEnd('DAILY', now, WARSAW))).toBe(
      '2026-10-05T22:00:00.000Z',
    );
  });

  it('DAILY at exactly midnight ends a full day later', () => {
    const now = new Date('2026-10-05T22:00:00Z');
    expect(iso(getPeriodEnd('DAILY', now, WARSAW))).toBe(
      '2026-10-06T22:00:00.000Z',
    );
  });

  it('WEEKLY ends at the next local Monday midnight', () => {
    // Monday 2026-10-05 -> Monday 2026-10-12 00:00 Warsaw.
    const monday = new Date('2026-10-05T12:00:00Z');
    const sunday = new Date('2026-10-11T21:59:00Z');
    const expected = '2026-10-11T22:00:00.000Z';

    expect(iso(getPeriodEnd('WEEKLY', monday, WARSAW))).toBe(expected);
    expect(iso(getPeriodEnd('WEEKLY', sunday, WARSAW))).toBe(expected);
  });

  it('depends on the timezone', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    // Midnight in New York (UTC-4) is 04:00 UTC.
    expect(iso(getPeriodEnd('DAILY', now, NEW_YORK))).toBe(
      '2026-10-06T04:00:00.000Z',
    );
  });

  it('handles the 23-hour day when clocks go forward', () => {
    // Sunday 2026-03-29 starts at UTC+1 and ends at UTC+2.
    const start = new Date('2026-03-28T23:00:00Z');
    const end = getPeriodEnd('DAILY', start, WARSAW)!;

    expect(iso(end)).toBe('2026-03-29T22:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('handles the 25-hour day when clocks go back', () => {
    // Sunday 2026-10-25 starts at UTC+2 and ends at UTC+1.
    const start = new Date('2026-10-24T22:00:00Z');
    const end = getPeriodEnd('DAILY', start, WARSAW)!;

    expect(iso(end)).toBe('2026-10-25T23:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it('the key changes exactly at the returned instant', () => {
    const now = new Date('2026-12-31T12:00:00Z');
    for (const type of ['DAILY', 'WEEKLY'] as const) {
      const end = getPeriodEnd(type, now, WARSAW)!;
      const justBefore = new Date(end.getTime() - 1);

      expect(getPeriodKey(type, justBefore, WARSAW)).toBe(
        getPeriodKey(type, now, WARSAW),
      );
      expect(getPeriodKey(type, end, WARSAW)).not.toBe(
        getPeriodKey(type, now, WARSAW),
      );
    }
  });
});
