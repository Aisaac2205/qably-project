import {
  buildDashboardOverview,
  type CaseCountRow,
  type CasesPassingRow,
  type ProjectRow,
  type RecentRunRow,
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
      recentRuns: [],
    });

    expect(record.passRateSeries.current).toEqual([
      { date: '2026-06-10', passRate: null, runs: 0, failedRuns: 0 },
      { date: '2026-06-11', passRate: null, runs: 0, failedRuns: 0 },
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
      recentRuns: [],
    });

    expect(record.passRateSeries.current[0]).toEqual({
      date: '2026-06-10',
      passRate: 0.75,
      runs: 4,
      failedRuns: 1,
    });
    expect(record.passRateSeries.current[1]).toEqual({
      date: '2026-06-11',
      passRate: null,
      runs: 0,
      failedRuns: 0,
    });
  });
});

describe('buildDashboardOverview weekly granularity (period 90)', () => {
  it('groups daily buckets into ISO weeks', () => {
    const record = buildDashboardOverview({
      period: 90,
      zone: 'UTC',
      currentDayKeys: [
        '2026-06-08',
        '2026-06-09',
        '2026-06-10',
        '2026-06-15',
        '2026-06-16',
      ],
      previousDayKeys: [],
      caseCountRows: [
        caseRow({ day: '2026-06-08', status: 'pass', count: 1 }),
        caseRow({ day: '2026-06-15', status: 'pass', count: 2 }),
      ],
      runCountRows: [
        runRow({ day: '2026-06-08', runs: 1 }),
        runRow({ day: '2026-06-15', runs: 2 }),
      ],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
      recentRuns: [],
    });

    expect(record.passRateSeries.current).toHaveLength(2);
    expect(record.passRateSeries.current[0]).toMatchObject({
      date: '2026-06-08',
      runs: 1,
    });
    expect(record.passRateSeries.current[1]).toMatchObject({
      date: '2026-06-15',
      runs: 2,
    });
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
      recentRuns: [],
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
      recentRuns: [],
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
      recentRuns: [],
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
      recentRuns: [],
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
      recentRuns: [],
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

describe('buildDashboardOverview recent runs', () => {
  it('maps recent run rows, omitting absent optional fields and computing passRate from caseCounts', () => {
    const rows: RecentRunRow[] = [
      {
        id: 'run-1',
        projectId: 'project-1',
        projectName: 'Checkout',
        suiteId: 'suite-1',
        suiteName: 'Checkout suite',
        name: 'Nightly regression',
        status: 'pass',
        source: 'github_actions',
        startedAt: new Date('2026-06-10T09:00:00.000Z'),
        finishedAt: new Date('2026-06-10T09:05:00.000Z'),
        commitSha: 'abc123',
        commitMessage: 'fix: retry flaky step',
        commitAuthor: 'Aisaac2205',
        caseCounts: {
          total: 4,
          pending: 0,
          running: 0,
          pass: 3,
          fail: 1,
          skip: 0,
          blocked: 0,
        },
      },
      {
        id: 'run-2',
        projectId: 'project-2',
        projectName: 'Billing',
        suiteId: 'suite-2',
        suiteName: 'Billing suite',
        name: 'Manual smoke',
        status: 'pending',
        source: 'manual',
        startedAt: new Date('2026-06-09T09:00:00.000Z'),
        finishedAt: null,
        commitSha: null,
        commitMessage: null,
        commitAuthor: null,
        caseCounts: {
          total: 0,
          pending: 2,
          running: 0,
          pass: 0,
          fail: 0,
          skip: 0,
          blocked: 0,
        },
      },
    ];

    const record = buildDashboardOverview({
      period: 7,
      zone: 'UTC',
      currentDayKeys: [],
      previousDayKeys: [],
      caseCountRows: [],
      runCountRows: [],
      casesPassingRows: [],
      projects: [],
      suiteCountByProjectId: new Map(),
      caseCountByProjectId: new Map(),
      lastRunAtByProjectId: new Map(),
      recentRuns: rows,
    });

    expect(record.recentRuns).toEqual([
      {
        id: 'run-1',
        projectId: 'project-1',
        projectName: 'Checkout',
        suiteId: 'suite-1',
        suiteName: 'Checkout suite',
        name: 'Nightly regression',
        status: 'pass',
        source: 'github_actions',
        startedAt: '2026-06-10T09:00:00.000Z',
        finishedAt: '2026-06-10T09:05:00.000Z',
        commitSha: 'abc123',
        commitMessage: 'fix: retry flaky step',
        commitAuthor: 'Aisaac2205',
        passRate: 0.75,
      },
      {
        id: 'run-2',
        projectId: 'project-2',
        projectName: 'Billing',
        suiteId: 'suite-2',
        suiteName: 'Billing suite',
        name: 'Manual smoke',
        status: 'pending',
        source: 'manual',
        startedAt: '2026-06-09T09:00:00.000Z',
        passRate: null,
      },
    ]);
  });
});
