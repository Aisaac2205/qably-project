import {
  DASHBOARD_PERIODS,
  calendarDayKeys,
  computeCalendarWindow,
  isDashboardPeriod,
} from './calendar-window';

describe('isDashboardPeriod', () => {
  it('accepts 7, 30 and 90', () => {
    expect(isDashboardPeriod(7)).toBe(true);
    expect(isDashboardPeriod(30)).toBe(true);
    expect(isDashboardPeriod(90)).toBe(true);
  });

  it('rejects any other value', () => {
    expect(isDashboardPeriod(15)).toBe(false);
    expect(isDashboardPeriod(0)).toBe(false);
  });

  it('lists exactly the three supported periods', () => {
    expect(DASHBOARD_PERIODS).toEqual([7, 30, 90]);
  });
});

describe('computeCalendarWindow', () => {
  const now = new Date('2026-06-16T20:00:00.000Z');

  it('ends the current window today inclusive, in the resolved zone', () => {
    const window = computeCalendarWindow(7, 'UTC', now);

    expect(window.currentEnd.toISOString()).toBe('2026-06-16T20:00:00.000Z');
  });

  it('starts the current window (period - 1) calendar days before today', () => {
    const window = computeCalendarWindow(7, 'UTC', now);

    expect(window.currentStart.toISOString()).toBe('2026-06-10T00:00:00.000Z');
  });

  it('sets the previous window as the equal-length window immediately before', () => {
    const window = computeCalendarWindow(30, 'UTC', now);

    expect(window.previousEnd.getTime()).toBe(window.currentStart.getTime());
    expect(window.previousStart.toISOString()).toBe('2026-04-18T00:00:00.000Z');
  });

  it('aligns window boundaries to local midnight in a negative-offset zone', () => {
    const window = computeCalendarWindow(7, 'America/Guatemala', now);

    expect(window.currentStart.toISOString()).toBe('2026-06-10T06:00:00.000Z');
  });

  it('aligns window boundaries to local midnight in a positive-offset zone, rolling "today" forward first', () => {
    const window = computeCalendarWindow(7, 'Asia/Tokyo', now);

    expect(window.currentStart.toISOString()).toBe('2026-06-10T15:00:00.000Z');
  });

  it('throws for a period outside 7/30/90', () => {
    expect(() => computeCalendarWindow(15 as never, 'UTC', now)).toThrow();
  });
});

describe('calendarDayKeys', () => {
  const now = new Date('2026-06-16T20:00:00.000Z');

  it('lists exactly `period` ascending day keys for the current window, ending today', () => {
    const { current } = calendarDayKeys(7, 'UTC', now);

    expect(current).toEqual([
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
      '2026-06-15',
      '2026-06-16',
    ]);
  });

  it('lists the equal-length previous window immediately before the current one', () => {
    const { previous } = calendarDayKeys(7, 'UTC', now);

    expect(previous).toEqual([
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
      '2026-06-08',
      '2026-06-09',
    ]);
  });

  it('rolls "today" forward first in a positive-offset zone, matching computeCalendarWindow', () => {
    const { current } = calendarDayKeys(7, 'Asia/Tokyo', now);

    expect(current[current.length - 1]).toBe('2026-06-17');
    expect(current[0]).toBe('2026-06-11');
  });

  it('throws for a period outside 7/30/90', () => {
    expect(() => calendarDayKeys(15 as never, 'UTC', now)).toThrow();
  });
});
