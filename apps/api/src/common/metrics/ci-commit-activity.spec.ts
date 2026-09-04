import {
  buildCiCommitActivity,
  type CiCommitRunRow,
} from './ci-commit-activity';

function row(overrides: Partial<CiCommitRunRow> = {}): CiCommitRunRow {
  return {
    commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
    commitMessage:
      'fix(ci): retry throttled run reports instead of dropping them',
    commitAuthor: 'Aisaac2205',
    status: 'pass',
    startedAt: new Date('2026-06-16T10:00:00.000Z'),
    ...overrides,
  };
}

describe('buildCiCommitActivity', () => {
  it('collapses every run of one commit into a single entry', () => {
    const activity = buildCiCommitActivity([
      row({ startedAt: new Date('2026-06-16T10:00:00.000Z') }),
      row({ startedAt: new Date('2026-06-16T10:02:00.000Z') }),
      row({ startedAt: new Date('2026-06-16T10:04:00.000Z') }),
    ]);

    expect(activity).toHaveLength(1);
    expect(activity[0].runCount).toBe(3);
    expect(activity[0].passedRunCount).toBe(3);
  });

  it('counts every run of the commit, not just the ones on the first page', () => {
    const runs = Array.from({ length: 214 }, (_, index) =>
      row({ status: index === 87 ? 'fail' : 'pass' }),
    );

    const activity = buildCiCommitActivity(runs);

    expect(activity[0].runCount).toBe(214);
    expect(activity[0].passedRunCount).toBe(213);
    expect(activity[0].status).toBe('fail');
  });

  it('keeps distinct commits apart', () => {
    const activity = buildCiCommitActivity([
      row({ commitSha: 'aaaaaaa1111111111111111111111111111111111' }),
      row({ commitSha: 'bbbbbbb2222222222222222222222222222222222' }),
    ]);

    expect(activity).toHaveLength(2);
  });

  it('rolls a single failing run up to a failing commit', () => {
    const activity = buildCiCommitActivity([
      row({ status: 'pass' }),
      row({ status: 'fail' }),
      row({ status: 'pass' }),
    ]);

    expect(activity[0].status).toBe('fail');
    expect(activity[0].passedRunCount).toBe(2);
  });

  it('reports a commit as running while nothing has failed', () => {
    const activity = buildCiCommitActivity([
      row({ status: 'pass' }),
      row({ status: 'running' }),
    ]);

    expect(activity[0].status).toBe('running');
  });

  it('lets a failure outrank a run still in flight', () => {
    const activity = buildCiCommitActivity([
      row({ status: 'running' }),
      row({ status: 'fail' }),
    ]);

    expect(activity[0].status).toBe('fail');
  });

  it('reports a commit as pending only when nothing failed or is running', () => {
    const activity = buildCiCommitActivity([
      row({ status: 'pass' }),
      row({ status: 'pending' }),
    ]);

    expect(activity[0].status).toBe('pending');
  });

  it('anchors the commit on its most recent run', () => {
    const activity = buildCiCommitActivity([
      row({ startedAt: new Date('2026-06-16T10:00:00.000Z') }),
      row({ startedAt: new Date('2026-06-16T10:09:00.000Z') }),
      row({ startedAt: new Date('2026-06-16T10:04:00.000Z') }),
    ]);

    expect(activity[0].lastRunAt).toBe('2026-06-16T10:09:00.000Z');
  });

  it('orders commits by their most recent run, newest first', () => {
    const activity = buildCiCommitActivity([
      row({
        commitSha: 'aaaaaaa1111111111111111111111111111111111',
        startedAt: new Date('2026-06-14T10:00:00.000Z'),
      }),
      row({
        commitSha: 'bbbbbbb2222222222222222222222222222222222',
        startedAt: new Date('2026-06-16T10:00:00.000Z'),
      }),
    ]);

    expect(activity.map((entry) => entry.shortSha)).toEqual([
      'bbbbbbb',
      'aaaaaaa',
    ]);
  });

  it('shortens the sha to seven characters for display', () => {
    const activity = buildCiCommitActivity([row()]);

    expect(activity[0].shortSha).toBe('d2f363d');
  });

  it('omits the message and author instead of inventing empty strings', () => {
    const activity = buildCiCommitActivity([
      row({ commitMessage: null, commitAuthor: null }),
    ]);

    expect(activity[0].commitMessage).toBeUndefined();
    expect(activity[0].commitAuthor).toBeUndefined();
  });

  it('keeps the first message it finds when later runs of the commit carry none', () => {
    const activity = buildCiCommitActivity([
      row({ commitMessage: null }),
      row({ commitMessage: 'feat: real message' }),
    ]);

    expect(activity[0].commitMessage).toBe('feat: real message');
  });

  it('returns nothing for an empty list', () => {
    expect(buildCiCommitActivity([])).toEqual([]);
  });
});
