import {
  buildRecentActivity,
  selectLatestRunPerSuite,
  type RecentActivityRunRow,
} from './recent-activity';

function row(
  overrides: Partial<RecentActivityRunRow> = {},
): RecentActivityRunRow {
  return {
    id: 'run-1',
    projectId: 'project-1',
    projectName: 'Checkout',
    suiteId: 'suite-1',
    suiteName: 'Checkout suite',
    name: 'Nightly regression',
    source: 'github_actions',
    status: 'pass',
    startedAt: new Date('2026-06-16T10:00:00.000Z'),
    commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
    commitMessage: 'fix(ci): retry throttled run reports',
    commitAuthor: 'Aisaac2205',
    caseCounts: {
      total: 4,
      pending: 0,
      running: 0,
      pass: 4,
      fail: 0,
      skip: 0,
      blocked: 0,
    },
    ...overrides,
  };
}

describe('buildRecentActivity', () => {
  it('flips the commit entry to pass once the failed suite reruns and passes', () => {
    const activity = buildRecentActivity([
      row({
        suiteId: 'suite-1',
        status: 'fail',
        startedAt: new Date('2026-06-16T10:00:00.000Z'),
        caseCounts: {
          total: 4,
          pending: 0,
          running: 0,
          pass: 2,
          fail: 2,
          skip: 0,
          blocked: 0,
        },
      }),
      row({
        id: 'run-2',
        suiteId: 'suite-1',
        status: 'pass',
        startedAt: new Date('2026-06-16T10:10:00.000Z'),
        caseCounts: {
          total: 4,
          pending: 0,
          running: 0,
          pass: 4,
          fail: 0,
          skip: 0,
          blocked: 0,
        },
      }),
    ]);

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      kind: 'commit',
      status: 'pass',
      casesPassed: 4,
      casesTotal: 4,
    });
  });

  it('rolls a commit up to fail when one of its two latest suite runs is fail and the other is running', () => {
    const activity = buildRecentActivity([
      row({ suiteId: 'suite-1', status: 'running' }),
      row({
        id: 'run-2',
        suiteId: 'suite-2',
        status: 'fail',
        startedAt: new Date('2026-06-16T10:01:00.000Z'),
      }),
    ]);

    expect(activity).toHaveLength(1);
    expect(activity[0].status).toBe('fail');
  });

  it('keeps a run without a commitSha as its own standalone entry', () => {
    const activity = buildRecentActivity([
      row({
        id: 'run-standalone',
        commitSha: null,
        commitMessage: null,
        commitAuthor: null,
      }),
      row({ id: 'run-committed' }),
    ]);

    expect(activity).toHaveLength(2);
    const standalone = activity.find((entry) => entry.kind === 'run');
    expect(standalone).toMatchObject({ kind: 'run', runId: 'run-standalone' });
  });

  it('splits the same commit SHA in two projects into two separate entries', () => {
    const activity = buildRecentActivity([
      row({ id: 'run-a', projectId: 'project-1', projectName: 'Checkout' }),
      row({ id: 'run-b', projectId: 'project-2', projectName: 'Billing' }),
    ]);

    expect(activity).toHaveLength(2);
    expect(activity.map((entry) => entry.projectName).sort()).toEqual([
      'Billing',
      'Checkout',
    ]);
  });

  it('caps the list at 4 entries, most recent first', () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({
        id: `run-${index}`,
        commitSha: `sha-${index}`.padEnd(40, '0'),
        startedAt: new Date(2026, 5, 10 + index),
      }),
    );

    const activity = buildRecentActivity(rows);

    expect(activity).toHaveLength(4);
    expect(activity[0].occurredAt > activity[3].occurredAt).toBe(true);
  });

  it('returns an empty list when there is nothing in scope', () => {
    expect(buildRecentActivity([])).toEqual([]);
  });
});

describe('selectLatestRunPerSuite', () => {
  it('keeps only the most recent run for each suite', () => {
    const latest = selectLatestRunPerSuite([
      row({
        id: 'run-old',
        suiteId: 'suite-1',
        startedAt: new Date('2026-06-16T09:00:00.000Z'),
      }),
      row({
        id: 'run-new',
        suiteId: 'suite-1',
        startedAt: new Date('2026-06-16T10:00:00.000Z'),
      }),
      row({
        id: 'run-other',
        suiteId: 'suite-2',
        startedAt: new Date('2026-06-16T09:30:00.000Z'),
      }),
    ]);

    expect(latest).toHaveLength(2);
    expect(latest.map((entry) => entry.id).sort()).toEqual([
      'run-new',
      'run-other',
    ]);
  });
});
