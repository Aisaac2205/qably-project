import {
  buildSuiteMetrics,
  SUITE_METRICS_TREND_LIMIT,
  type RankedRunRow,
} from './suite-metrics';

function row(overrides: Partial<RankedRunRow> = {}): RankedRunRow {
  return {
    id: 'run-1',
    suiteId: 'suite-1',
    status: 'pass',
    source: 'manual',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:05:00.000Z'),
    ...overrides,
  };
}

describe('buildSuiteMetrics', () => {
  it('returns null lastRun and an empty trend for a suite with no runs', () => {
    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      [],
      new Map(),
    );

    expect(entry).toEqual({
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: null,
      trend: [],
    });
  });

  it('returns one entry per suite id, in the given order', () => {
    const entries = buildSuiteMetrics(
      [
        { id: 'suite-1', name: 'Checkout' },
        { id: 'suite-2', name: 'Auth' },
      ],
      [],
      new Map(),
    );

    expect(entries.map((entry) => entry.suiteId)).toEqual([
      'suite-1',
      'suite-2',
    ]);
  });

  it('carries the suite name onto the entry so the client never resolves it', () => {
    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      [],
      new Map(),
    );

    expect(entry.suiteName).toBe('Checkout');
  });

  it('uses the most recent run (first row per suite) as lastRun', () => {
    const rows = [
      row({ id: 'run-2', startedAt: new Date('2026-01-02T00:00:00.000Z') }),
      row({ id: 'run-1', startedAt: new Date('2026-01-01T00:00:00.000Z') }),
    ];

    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      rows,
      new Map([['run-2', 1]]),
    );

    expect(entry.lastRun?.id).toBe('run-2');
    expect(entry.lastRun?.passRate).toBe(1);
  });

  it('reports 0 passRate when the run id is missing from the map', () => {
    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      [row()],
      new Map(),
    );

    expect(entry.lastRun?.passRate).toBe(0);
  });

  it('omits finishedAt when the run has not finished', () => {
    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      [row({ finishedAt: null })],
      new Map(),
    );

    expect(entry.lastRun).not.toHaveProperty('finishedAt');
  });

  it('builds the trend oldest-first from the descending-ordered rows', () => {
    const rows = [
      row({
        id: 'run-3',
        status: 'pass',
        startedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
      row({
        id: 'run-2',
        status: 'fail',
        startedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      row({
        id: 'run-1',
        status: 'pass',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ];

    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      rows,
      new Map(),
    );

    expect(entry.trend).toEqual(['pass', 'fail', 'pass']);
  });

  it('never returns more trend entries than the configured limit', () => {
    expect(SUITE_METRICS_TREND_LIMIT).toBe(10);
  });

  it('assigns rows to the right suite when several suites are ranked together', () => {
    const rows = [
      row({ id: 'run-a1', suiteId: 'suite-a', status: 'pass' }),
      row({ id: 'run-b1', suiteId: 'suite-b', status: 'fail' }),
    ];

    const entries = buildSuiteMetrics(
      [
        { id: 'suite-a', name: 'Suite A' },
        { id: 'suite-b', name: 'Suite B' },
      ],
      rows,
      new Map(),
    );
    const bySuite = new Map(entries.map((entry) => [entry.suiteId, entry]));

    expect(bySuite.get('suite-a')?.lastRun?.id).toBe('run-a1');
    expect(bySuite.get('suite-b')?.lastRun?.id).toBe('run-b1');
  });

  it('ignores rows for a suite id that is not in the requested list', () => {
    const rows = [row({ id: 'run-x', suiteId: 'suite-not-requested' })];

    const [entry] = buildSuiteMetrics(
      [{ id: 'suite-1', name: 'Checkout' }],
      rows,
      new Map(),
    );

    expect(entry.lastRun).toBeNull();
  });
});
