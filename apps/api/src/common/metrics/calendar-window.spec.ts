import {
  DASHBOARD_PERIODS,
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
