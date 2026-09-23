import {
  buildDashboardOverview,
  type CaseCountRow,
  type CasesPassingRow,
  type ProjectRow,
  type RunCountRow,
} from './dashboard-overview';

function caseRow(overrides: Partial<CaseCountRow> = {}): CaseCountRow {
  return {
    projectId: 'project-1',
    window: 'current',
    day: '2026-06-10',
    status: 'pass',
    count: 1,
    ...overrides,
  };
}

function runRow(overrides: Partial<RunCountRow> = {}): RunCountRow {
  return {
    window: 'current',
    day: '2026-06-10',
    runs: 1,
    failedRuns: 0,
    finishedRuns: 1,
    durationSumMs: 1000,
    ...overrides,
  };
}

describe('buildDashboardOverview daily granularity', () => {
  it('reports null passRate, 0 runs and 0 failedRuns for a day with no data', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10', '2026-06-11'],
      previousDayKeys: ['2026-06-03', '2026-06-04'],
      caseCountRows: [],
      runCountRows: [],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current).toEqual([
      {
        date: '2026-06-10',
        passRate: null,
        runs: 0,
        failedRuns: 0,
        executed: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
      },
      {
        date: '2026-06-11',
        passRate: null,
        runs: 0,
        failedRuns: 0,
        executed: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
      },
    ]);
  });

  it('produces one bucket per calendar day and merges case + run rows into it', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10', '2026-06-11'],
      previousDayKeys: [],
      caseCountRows: [
        caseRow({ day: '2026-06-10', status: 'pass', count: 3 }),
        caseRow({ day: '2026-06-10', status: 'fail', count: 1 }),
      ],
      runCountRows: [runRow({ day: '2026-06-10', runs: 4, failedRuns: 1 })],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current[0]).toEqual({
      date: '2026-06-10',
      passRate: 0.75,
      runs: 4,
      failedRuns: 1,
      executed: 4,
      passed: 3,
      failed: 1,
      blocked: 0,
    });
    expect(record.passRateSeries.current[1]).toEqual({
      date: '2026-06-11',
      passRate: null,
      runs: 0,
      failedRuns: 0,
      executed: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
    });
  });

  it('reports executed/passed/failed/blocked from the same per-day run_case status aggregation as passRate, including skipped cases in executed but not in the other three', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10'],
      previousDayKeys: [],
      caseCountRows: [
        caseRow({ day: '2026-06-10', status: 'pass', count: 5 }),
        caseRow({ day: '2026-06-10', status: 'fail', count: 2 }),
        caseRow({ day: '2026-06-10', status: 'blocked', count: 1 }),
        caseRow({ day: '2026-06-10', status: 'skip', count: 3 }),
      ],
      runCountRows: [],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current[0]).toMatchObject({
      executed: 11,
      passed: 5,
      failed: 2,
      blocked: 1,
    });
  });
});

function daysFrom(startDate: string, count: number): string[] {
  const [year, month, day] = startDate.split('-').map(Number);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index));

    return date.toISOString().slice(0, 10);
  });
}

describe('buildDashboardOverview weekly granularity (period 90)', () => {
  it('produces the same number of buckets for current and previous windows', () => {
    const record = buildDashboardOverview({
      period: 90,
      zone: 'UTC',
      currentDayKeys: daysFrom('2026-06-03', 90),
      previousDayKeys: daysFrom('2026-03-05', 90),
      caseCountRows: [],
      runCountRows: [],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current.length).toBe(
      record.passRateSeries.previous.length,
    );
  });

  it('chunks a 90-day window into 13 buckets, the last holding the remaining 6 days', () => {
    const currentDayKeys = daysFrom('2026-06-03', 90);

    const record = buildDashboardOverview({
      period: 90,
      zone: 'UTC',
      currentDayKeys,
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current).toHaveLength(13);
    expect(record.passRateSeries.current[0].date).toBe(currentDayKeys[0]);
    expect(record.passRateSeries.current[12].date).toBe(currentDayKeys[84]);
  });

  it('assigns a run on the chunk boundary day to the chunk it falls into, by index', () => {
    const currentDayKeys = daysFrom('2026-06-03', 90);
    const lastDayOfFirstChunk = currentDayKeys[6];
    const firstDayOfSecondChunk = currentDayKeys[7];

    const record = buildDashboardOverview({
      period: 90,
      zone: 'UTC',
      currentDayKeys,
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [
        runRow({ day: lastDayOfFirstChunk, runs: 1 }),
        runRow({ day: firstDayOfSecondChunk, runs: 5 }),
      ],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current[0].runs).toBe(1);
    expect(record.passRateSeries.current[1].runs).toBe(5);
  });

  it('sums only the remaining days of the window into the last partial chunk', () => {
    const currentDayKeys = daysFrom('2026-06-03', 90);
    const lastDay = currentDayKeys[89];

    const record = buildDashboardOverview({
      period: 90,
      zone: 'UTC',
      currentDayKeys,
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [runRow({ day: lastDay, runs: 3 })],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.passRateSeries.current).toHaveLength(13);
    expect(record.passRateSeries.current[12].runs).toBe(3);
  });

  it('applies the same window-anchored chunking to the KPI sparkline series', () => {
    const currentDayKeys = daysFrom('2026-06-03', 90);
    const previousDayKeys = daysFrom('2026-03-05', 90);

    const record = buildDashboardOverview({
      period: 90,
      zone: 'UTC',
      currentDayKeys,
      previousDayKeys,
      caseCountRows: [],
      runCountRows: [],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.kpis.runs.series).toHaveLength(13);
  });
});

describe('buildDashboardOverview KPI aggregation', () => {
  it('reports each KPI value as the aggregate of its own series, not a mean of daily rates', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10', '2026-06-11'],
      previousDayKeys: [],
      caseCountRows: [
        caseRow({ day: '2026-06-10', status: 'pass', count: 1 }),
        caseRow({ day: '2026-06-10', status: 'fail', count: 1 }),
        caseRow({ day: '2026-06-11', status: 'pass', count: 8 }),
      ],
      runCountRows: [
        runRow({ day: '2026-06-10', runs: 2, failedRuns: 1 }),
        runRow({ day: '2026-06-11', runs: 8, failedRuns: 0 }),
      ],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.kpis.passRate.value).toBeCloseTo(9 / 10);
    expect(record.kpis.runs.value).toBe(10);
    expect(record.kpis.failedCases.value).toBe(1);
  });

  it('excludes in-flight runs from avgRunDurationMs', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10'],
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [
        runRow({
          day: '2026-06-10',
          runs: 2,
          finishedRuns: 1,
          durationSumMs: 5000,
        }),
      ],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.kpis.avgRunDurationMs.value).toBe(5000);
  });

  it('reports null avgRunDurationMs when no run in the window has finished', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10'],
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [
        runRow({
          day: '2026-06-10',
          runs: 1,
          finishedRuns: 0,
          durationSumMs: 0,
        }),
      ],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.kpis.avgRunDurationMs.value).toBeNull();
  });
});

describe('buildDashboardOverview casesPassing', () => {
  it('aggregates the given latest-finished-run-per-suite rows', () => {
    const rows: CasesPassingRow[] = [
      { status: 'pass', count: 5 },
      { status: 'fail', count: 2 },
      { status: 'blocked', count: 1 },
    ];

    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: [],
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [],
      casesPassingRows: rows,
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
    });

    expect(record.casesPassing).toEqual({
      total: 8,
      pending: 0,
      running: 0,
      pass: 5,
      fail: 2,
      skip: 0,
      blocked: 1,
    });
  });
});

describe('buildDashboardOverview project rows', () => {
  const projects: ProjectRow[] = [
    { id: 'project-1', name: 'Checkout' },
    { id: 'project-2', name: 'Billing' },
  ];

  it('reports each project’s pass rate over the resolved period, not a lifetime health score', () => {
    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: ['2026-06-10'],
      previousDayKeys: [],
      caseCountRows: [
        caseRow({ projectId: 'project-1', status: 'pass', count: 1 }),
        caseRow({ projectId: 'project-1', status: 'fail', count: 1 }),
        caseRow({
          projectId: 'project-2',
          window: 'previous',
          day: '2026-06-03',
          status: 'pass',
          count: 9,
        }),
      ],
      runCountRows: [],
      casesPassingRows: [],
      projects,
      suiteCountByProjectId: new Map([
        ['project-1', 3],
        ['project-2', 1],
      ]),
      caseCountByProjectId: new Map([
        ['project-1', 10],
        ['project-2', 2],
      ]),
      lastRunAtByProjectId: new Map([
        ['project-1', new Date('2026-06-10T09:00:00.000Z')],
      ]),
    });

    expect(record.projects).toEqual([
      {
        id: 'project-1',
        name: 'Checkout',
        suites: 3,
        cases: 10,
        passRate: 0.5,
        lastRunAt: '2026-06-10T09:00:00.000Z',
      },
      {
        id: 'project-2',
        name: 'Billing',
        suites: 1,
        cases: 2,
        passRate: null,
      },
    ]);
  });
});
