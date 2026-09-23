import {
  buildActivityEntry,
  buildRecentActivityFromAggregates,
  rollUpStatuses,
  type ActivityAggregateRow,
} from './recent-activity';

function aggregateRow(
  overrides: Partial<ActivityAggregateRow> = {},
): ActivityAggregateRow {
  return {
    projectId: 'project-1',
    activityKey: 'd2f363de80e51157947e36f40d2965404e162b21',
    commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
    projectName: 'Checkout',
    suiteCount: 1,
    statuses: ['pass'],
    anchorRunId: 'run-2',
    anchorRunName: 'Nightly regression',
    anchorSuiteName: 'Checkout suite',
    anchorSource: 'github_actions',
    anchorStartedAt: new Date('2026-06-16T10:10:00.000Z'),
    anchorCommitMessage: 'fix(ci): retry throttled run reports',
    anchorCommitAuthor: 'Aisaac2205',
    casesPassed: 4,
    casesTotal: 4,
    ...overrides,
  };
}

describe('rollUpStatuses', () => {
  it('rolls fail over running, pending and pass', () => {
    expect(rollUpStatuses(['pass', 'running', 'fail', 'pending'])).toBe('fail');
  });

  it('rolls running over pending and pass', () => {
    expect(rollUpStatuses(['pass', 'pending', 'running'])).toBe('running');
  });

  it('rolls pending over pass', () => {
    expect(rollUpStatuses(['pass', 'pending'])).toBe('pending');
  });

  it('is pass only when every status is pass', () => {
    expect(rollUpStatuses(['pass', 'pass'])).toBe('pass');
  });

  it('is pass for an empty status list (identity element)', () => {
    expect(rollUpStatuses([])).toBe('pass');
  });
});

describe('buildActivityEntry', () => {
  it('maps a commit aggregate row to a commit entry, using the anchor for commit fields', () => {
    const entry = buildActivityEntry(
      aggregateRow({
        statuses: ['fail', 'pass'],
        suiteCount: 2,
        casesPassed: 2,
        casesTotal: 3,
      }),
    );

    expect(entry).toEqual({
      kind: 'commit',
      projectId: 'project-1',
      projectName: 'Checkout',
      status: 'fail',
      source: 'github_actions',
      occurredAt: '2026-06-16T10:10:00.000Z',
      casesPassed: 2,
      casesTotal: 3,
      commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
      suiteCount: 2,
      commitMessage: 'fix(ci): retry throttled run reports',
      commitAuthor: 'Aisaac2205',
    });
  });

  it('uses the anchor run commit message and author, not any other suite run in the group', () => {
    const entry = buildActivityEntry(
      aggregateRow({
        anchorCommitMessage: 'feat: add checkout retries',
        anchorCommitAuthor: 'octocat',
      }),
    );

    expect(entry).toMatchObject({
      commitMessage: 'feat: add checkout retries',
      commitAuthor: 'octocat',
    });
  });

  it('omits commitMessage and commitAuthor when the anchor run has none', () => {
    const entry = buildActivityEntry(
      aggregateRow({ anchorCommitMessage: null, anchorCommitAuthor: null }),
    );

    expect(entry).not.toHaveProperty('commitMessage');
    expect(entry).not.toHaveProperty('commitAuthor');
  });

  it('maps a standalone run aggregate row (no commitSha) to a run entry', () => {
    const entry = buildActivityEntry(
      aggregateRow({
        commitSha: null,
        activityKey: 'run-standalone',
        anchorRunId: 'run-standalone',
        anchorRunName: 'Manual smoke test',
        anchorSuiteName: 'Smoke',
      }),
    );

    expect(entry).toMatchObject({
      kind: 'run',
      runId: 'run-standalone',
      runName: 'Manual smoke test',
      suiteName: 'Smoke',
    });
    expect(entry).not.toHaveProperty('commitSha');
    expect(entry).not.toHaveProperty('suiteCount');
  });
});

describe('buildRecentActivityFromAggregates', () => {
  it('maps every aggregate row and preserves SQL ordering', () => {
    const rows = [
      aggregateRow({
        activityKey: 'sha-1',
        commitSha: 'sha-1',
        anchorStartedAt: new Date('2026-06-16T10:10:00.000Z'),
      }),
      aggregateRow({
        activityKey: 'sha-2',
        commitSha: 'sha-2',
        anchorStartedAt: new Date('2026-06-16T09:00:00.000Z'),
      }),
    ];

    const activity = buildRecentActivityFromAggregates(rows);

    expect(activity.map((entry) => entry.occurredAt)).toEqual([
      '2026-06-16T10:10:00.000Z',
      '2026-06-16T09:00:00.000Z',
    ]);
  });

  it('returns an empty list when there are no aggregate rows', () => {
    expect(buildRecentActivityFromAggregates([])).toEqual([]);
  });
});
