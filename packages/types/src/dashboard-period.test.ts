import { describe, it, expect } from 'vitest';
import { DASHBOARD_PERIODS, isDashboardPeriod } from './dashboard-period';

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
