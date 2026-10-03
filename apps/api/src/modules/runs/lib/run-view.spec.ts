import {
  RUN_LIST_SELECT,
  RUN_SELECT,
  toRunView,
  type RunRow,
} from './run-view';

function runRow(overrides: Partial<RunRow> = {}): RunRow {
  return {
    id: 'run-1',
    projectId: 'project-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    name: 'src/a.test.ts',
    status: 'pass',
    source: 'github_actions',
    externalId: 'gha-900-api-junit-unit-xml-ab12cd34',
    reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34',
    startedAt: new Date('2026-10-03T12:00:00.000Z'),
    finishedAt: null,
    executedById: null,
    commitSha: null,
    commitMessage: null,
    commitAuthor: null,
    ciRunId: null,
    ...overrides,
  };
}

describe('RUN_SELECT', () => {
  it('selects the ci run link', () => {
    expect(RUN_SELECT.ciRunId).toBe(true);
  });

  it('keeps the ci run link in the list select that spreads it', () => {
    expect(RUN_LIST_SELECT.ciRunId).toBe(true);
  });

  it('does not select the job key, which the run view never exposes', () => {
    expect(Object.keys(RUN_SELECT)).not.toContain('ciJobKey');
  });
});

describe('toRunView ciRunId', () => {
  it('includes ciRunId when the run is linked to a ci run', () => {
    const view = toRunView(runRow({ ciRunId: 'ci-1' }), []);

    expect(view.ciRunId).toBe('ci-1');
    expect(view.id).toBe('run-1');
    expect(view.name).toBe('src/a.test.ts');
  });

  it('omits the ciRunId key entirely when the run is not linked', () => {
    const view = toRunView(runRow({ ciRunId: null }), []);

    expect(view).not.toHaveProperty('ciRunId');
    expect(view.id).toBe('run-1');
  });
});
