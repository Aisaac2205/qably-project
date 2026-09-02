import {
  DASHBOARD_WINDOW_DAYS,
  RECENT_RUNS_LIMIT,
  buildCaseCountsByRun,
  computeHealthScore,
  computeMetricsWindow,
  computePassRate,
  computePassRateTrend,
  emptyCaseCounts,
  sumCaseCounts,
  tallyCaseStatuses,
} from './run-case-metrics';

describe('computeMetricsWindow', () => {
  it('anchors the current window end on now', () => {
    const now = new Date('2026-06-16T11:00:00.000Z');

    const window = computeMetricsWindow(now);

    expect(window.currentEnd).toEqual(now);
  });

  it('opens the current window windowDays before now', () => {
    const now = new Date('2026-06-16T11:00:00.000Z');

    const window = computeMetricsWindow(now, 7);

    expect(window.currentStart).toEqual(new Date('2026-06-09T11:00:00.000Z'));
  });

  it('places the previous window immediately before the current one with no gap or overlap', () => {
    const now = new Date('2026-06-16T11:00:00.000Z');

    const window = computeMetricsWindow(now, 7);

    expect(window.previousEnd).toEqual(window.currentStart);
    expect(window.previousStart).toEqual(new Date('2026-06-02T11:00:00.000Z'));
  });

  it('defaults to the dashboard window length when none is given', () => {
    const now = new Date('2026-06-16T11:00:00.000Z');

    const withDefault = computeMetricsWindow(now);
    const withExplicit = computeMetricsWindow(now, DASHBOARD_WINDOW_DAYS);

    expect(withDefault).toEqual(withExplicit);
  });
});

describe('tallyCaseStatuses', () => {
  it('sums counts per status and tracks the total', () => {
    const counts = tallyCaseStatuses([
      { status: 'pass', _count: { _all: 3 } },
      { status: 'fail', _count: { _all: 1 } },
      { status: 'pending', _count: { _all: 2 } },
    ]);

    expect(counts).toEqual({
      total: 6,
      pending: 2,
      running: 0,
      pass: 3,
      fail: 1,
      skip: 0,
      blocked: 0,
    });
  });

  it('returns all-zero counts for an empty group list', () => {
    expect(tallyCaseStatuses([])).toEqual(emptyCaseCounts());
  });
});

describe('buildCaseCountsByRun', () => {
  it('keeps counts separate per run', () => {
    const byRun = buildCaseCountsByRun([
      { runId: 'run-1', status: 'pass', _count: { _all: 2 } },
      { runId: 'run-2', status: 'fail', _count: { _all: 1 } },
    ]);

    expect(byRun.get('run-1')).toEqual(
      expect.objectContaining({ pass: 2, total: 2 }),
    );
    expect(byRun.get('run-2')).toEqual(
      expect.objectContaining({ fail: 1, total: 1 }),
    );
  });
});

describe('sumCaseCounts', () => {
  it('adds every field across the given counts', () => {
    const sum = sumCaseCounts([
      {
        total: 2,
        pending: 0,
        running: 0,
        pass: 2,
        fail: 0,
        skip: 0,
        blocked: 0,
      },
      {
        total: 3,
        pending: 1,
        running: 0,
        pass: 1,
        fail: 1,
        skip: 0,
        blocked: 0,
      },
    ]);

    expect(sum).toEqual({
      total: 5,
      pending: 1,
      running: 0,
      pass: 3,
      fail: 1,
      skip: 0,
      blocked: 0,
    });
  });

  it('returns all-zero counts for an empty list', () => {
    expect(sumCaseCounts([])).toEqual(emptyCaseCounts());
  });
});

describe('computePassRate', () => {
  it('divides pass by total', () => {
    expect(computePassRate({ pass: 3, total: 6 })).toBeCloseTo(0.5);
  });

  it('reports zero for a window with no cases instead of dividing by zero', () => {
    expect(computePassRate({ pass: 0, total: 0 })).toBe(0);
  });
});

describe('computeHealthScore', () => {
  it('renders the pass rate as a rounded percentage', () => {
    expect(computeHealthScore({ pass: 1, total: 3 })).toBe(33);
  });

  it('reports null, never zero, for a project with no cases in scope', () => {
    expect(computeHealthScore({ pass: 0, total: 0 })).toBeNull();
  });

  it('reports an honest zero when every case in scope failed', () => {
    expect(computeHealthScore({ pass: 0, total: 4 })).toBe(0);
  });
});

describe('computePassRateTrend', () => {
  it('reports a positive delta when the pass rate improved', () => {
    expect(computePassRateTrend(0.9, 0.7)).toBeCloseTo(0.2);
  });

  it('reports a negative delta when the pass rate regressed', () => {
    expect(computePassRateTrend(0.5, 0.8)).toBeCloseTo(-0.3);
  });

  it('reports zero when nothing changed', () => {
    expect(computePassRateTrend(0.6, 0.6)).toBe(0);
  });
});

describe('constants', () => {
  it('fixes the dashboard window at 7 days', () => {
    expect(DASHBOARD_WINDOW_DAYS).toBe(7);
  });

  it('caps the recent runs list at a small, named limit', () => {
    expect(RECENT_RUNS_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(RECENT_RUNS_LIMIT)).toBe(true);
  });
});
