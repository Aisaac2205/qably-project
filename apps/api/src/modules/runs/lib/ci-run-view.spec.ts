import {
  CI_RUN_JOB_RUN_SELECT,
  CI_RUN_SELECT,
  toCiRunJobRun,
  toCiRunSummary,
  type CiRunJobRunRow,
  type CiRunRow,
} from './ci-run-view';

const startedAt = new Date('2026-10-03T14:00:00.000Z');
const lastReportedAt = new Date('2026-10-03T14:12:20.000Z');

const fullRow: CiRunRow = {
  id: 'ci-run-1',
  projectId: 'project-1',
  source: 'github_actions',
  externalId: '900',
  workflowName: 'CI',
  runNumber: 42,
  runAttempt: 1,
  branch: 'main',
  headRef: 'feature/x',
  actor: 'ana',
  eventName: 'push',
  serverUrl: 'https://github.com',
  repository: 'acme/shop',
  commitSha: '1f2e3d4c5b6a79880011223344556677889900aa',
  commitMessage: 'fix: keep the cart total in sync',
  commitAuthor: 'Ana Lopez',
  startedAt,
  lastReportedAt,
};

const bareRow: CiRunRow = {
  id: 'ci-run-2',
  projectId: 'project-1',
  source: 'api',
  externalId: '901',
  workflowName: null,
  runNumber: null,
  runAttempt: null,
  branch: null,
  headRef: null,
  actor: null,
  eventName: null,
  serverUrl: null,
  repository: null,
  commitSha: null,
  commitMessage: null,
  commitAuthor: null,
  startedAt,
  lastReportedAt,
};

describe('toCiRunSummary', () => {
  it('maps every column and serialises both timestamps', () => {
    expect(toCiRunSummary(fullRow, 'failing')).toStrictEqual({
      id: 'ci-run-1',
      projectId: 'project-1',
      source: 'github_actions',
      externalId: '900',
      status: 'failing',
      startedAt: '2026-10-03T14:00:00.000Z',
      lastReportedAt: '2026-10-03T14:12:20.000Z',
      workflowName: 'CI',
      runNumber: 42,
      runAttempt: 1,
      branch: 'main',
      headRef: 'feature/x',
      actor: 'ana',
      eventName: 'push',
      serverUrl: 'https://github.com',
      repository: 'acme/shop',
      commitSha: '1f2e3d4c5b6a79880011223344556677889900aa',
      commitMessage: 'fix: keep the cart total in sync',
      commitAuthor: 'Ana Lopez',
    });
  });

  it('omits every null column instead of sending null', () => {
    expect(toCiRunSummary(bareRow, 'passing')).toStrictEqual({
      id: 'ci-run-2',
      projectId: 'project-1',
      source: 'api',
      externalId: '901',
      status: 'passing',
      startedAt: '2026-10-03T14:00:00.000Z',
      lastReportedAt: '2026-10-03T14:12:20.000Z',
    });
  });

  it('keeps a present value next to omitted ones', () => {
    const summary = toCiRunSummary(
      { ...bareRow, branch: 'main', runNumber: 7 },
      'passing',
    );

    expect(summary).toMatchObject({ branch: 'main', runNumber: 7 });
    expect(summary).not.toHaveProperty('headRef');
    expect(summary).not.toHaveProperty('commitSha');
  });
});

describe('CI_RUN_SELECT', () => {
  it('selects exactly the columns the row type carries', () => {
    expect(Object.keys(CI_RUN_SELECT).sort()).toEqual(
      Object.keys(fullRow).sort(),
    );
  });

  it('never selects the organization', () => {
    expect(CI_RUN_SELECT).not.toHaveProperty('organizationId');
  });
});

const linkedJobRun: CiRunJobRunRow = {
  id: 'run-1',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  status: 'fail',
  startedAt,
  ciJobKey: 'api',
  reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34',
  suite: { name: 'Checkout' },
};

describe('toCiRunJobRun', () => {
  it('maps the run, resolving the suite name and serialising the start', () => {
    expect(toCiRunJobRun(linkedJobRun)).toStrictEqual({
      id: 'run-1',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      name: 'Checkout regression',
      status: 'fail',
      startedAt: '2026-10-03T14:00:00.000Z',
      ciJobKey: 'api',
      reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34',
    });
  });

  it('omits the job key and the report id when they are null', () => {
    const run = toCiRunJobRun({
      ...linkedJobRun,
      status: 'pass',
      ciJobKey: null,
      reportExternalId: null,
    });

    expect(run).toStrictEqual({
      id: 'run-1',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      name: 'Checkout regression',
      status: 'pass',
      startedAt: '2026-10-03T14:00:00.000Z',
    });
  });

  it('keeps the job key when only the report id is null', () => {
    const run = toCiRunJobRun({ ...linkedJobRun, reportExternalId: null });

    expect(run).toMatchObject({ ciJobKey: 'api' });
    expect(run).not.toHaveProperty('reportExternalId');
  });
});

describe('CI_RUN_JOB_RUN_SELECT', () => {
  it('selects exactly the columns the row type carries', () => {
    expect(Object.keys(CI_RUN_JOB_RUN_SELECT).sort()).toEqual(
      Object.keys(linkedJobRun).sort(),
    );
  });

  it('selects only the suite name from the suite relation', () => {
    expect(CI_RUN_JOB_RUN_SELECT.suite).toEqual({ select: { name: true } });
  });
});
