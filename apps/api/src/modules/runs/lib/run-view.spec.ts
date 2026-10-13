import {
  CASE_READ_SELECT,
  RUN_LIST_SELECT,
  RUN_SELECT,
  toRunView,
  type RunCaseRow,
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

function liveCase(
  overrides: Partial<NonNullable<RunCaseRow['testCase']>> = {},
): NonNullable<RunCaseRow['testCase']> {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    name: 'Live catalog title',
    steps: ['Live step'],
    expectedResult: 'Live result',
    executionMode: 'automated',
    automationKey: 'src/a.test.ts::adds',
    automationClassName: 'src/a.test.ts',
    automationFilePath: 'src/a.test.ts',
    currentVersion: { version: 5 },
    ...overrides,
  };
}

function caseRow(overrides: Partial<RunCaseRow> = {}): RunCaseRow {
  return {
    id: 'run-case-1',
    testCaseId: 'case-1',
    name: 'adds',
    suiteName: 'Cart',
    steps: ['Reported step'],
    expectedResult: 'Reported result',
    status: 'pass',
    position: 0,
    recordedAt: null,
    testCase: liveCase(),
    catalogSnapshot: null,
    ...overrides,
  };
}

const executedSnapshot = {
  name: 'Executed catalog title',
  steps: ['Executed step 1', 'Executed step 2'],
  expectedResult: 'Executed result',
  version: 2,
};

describe('CASE_READ_SELECT', () => {
  it('reads the catalog snapshot alongside the live case', () => {
    expect(CASE_READ_SELECT.catalogSnapshot).toBe(true);
    expect(CASE_READ_SELECT.testCase.select.steps).toBe(true);
  });
});

describe('toRunView officialCase with a catalog snapshot', () => {
  it('shows the content the run executed instead of the live catalog content', () => {
    const view = toRunView(runRow(), [
      caseRow({ catalogSnapshot: executedSnapshot }),
    ]);

    expect(view.cases[0].officialCase).toMatchObject({
      name: 'Executed catalog title',
      steps: ['Executed step 1', 'Executed step 2'],
      expectedResult: 'Executed result',
      executedVersion: 2,
    });
  });

  it('keeps identity, links and automation metadata live', () => {
    const view = toRunView(runRow(), [
      caseRow({
        catalogSnapshot: executedSnapshot,
        testCase: liveCase({
          id: 'case-live',
          suiteId: 'suite-moved',
          executionMode: 'manual',
          automationKey: 'src/renamed.test.ts::adds',
          automationClassName: 'src/renamed.test.ts',
          automationFilePath: 'src/renamed.test.ts',
        }),
      }),
    ]);

    expect(view.cases[0].officialCase).toMatchObject({
      id: 'case-live',
      suiteId: 'suite-moved',
      executionMode: 'manual',
      automationKey: 'src/renamed.test.ts::adds',
      automationClassName: 'src/renamed.test.ts',
      automationFilePath: 'src/renamed.test.ts',
    });
  });

  it('keeps the live version separate from the version that was executed', () => {
    const view = toRunView(runRow(), [
      caseRow({ catalogSnapshot: executedSnapshot }),
    ]);

    expect(view.cases[0].officialCase?.version).toBe(5);
    expect(view.cases[0].officialCase?.executedVersion).toBe(2);
  });

  it('reports no executed version for a run that executed a draft', () => {
    const view = toRunView(runRow(), [
      caseRow({ catalogSnapshot: { ...executedSnapshot, version: null } }),
    ]);

    expect(view.cases[0].officialCase?.executedVersion).toBeNull();
    expect(view.cases[0].officialCase?.version).toBe(5);
  });

  it('does not change when the live case is edited after the snapshot was taken', () => {
    const snapshot = { ...executedSnapshot };
    const before = toRunView(runRow(), [
      caseRow({ catalogSnapshot: snapshot }),
    ]);

    const after = toRunView(runRow(), [
      caseRow({
        catalogSnapshot: snapshot,
        testCase: liveCase({
          name: 'Edited later',
          steps: ['Edited step'],
          expectedResult: 'Edited result',
          currentVersion: { version: 9 },
        }),
      }),
    ]);

    expect(after.cases[0].officialCase).toMatchObject({
      name: before.cases[0].officialCase?.name,
      steps: before.cases[0].officialCase?.steps,
      expectedResult: before.cases[0].officialCase?.expectedResult,
      executedVersion: before.cases[0].officialCase?.executedVersion,
    });
  });

  it('exposes no official case once the catalog case is deleted, because the view needs a live case to link to', () => {
    const view = toRunView(runRow(), [
      caseRow({
        testCaseId: null,
        testCase: null,
        catalogSnapshot: executedSnapshot,
      }),
    ]);

    expect(view.cases[0].officialCase).toBeNull();
    expect(view.cases[0].name).toBe('adds');
  });

  it('leaves the reported run case fields as the reporter sent them', () => {
    const view = toRunView(runRow(), [
      caseRow({ catalogSnapshot: executedSnapshot }),
    ]);

    expect(view.cases[0]).toMatchObject({
      name: 'adds',
      steps: ['Reported step'],
      expectedResult: 'Reported result',
    });
  });
});

describe('toRunView officialCase documented flag', () => {
  it('describes the live case, whatever the snapshot recorded', () => {
    const undocumentedWhenExecuted = {
      ...executedSnapshot,
      steps: [],
      expectedResult: '',
    };

    const view = toRunView(runRow(), [
      caseRow({ catalogSnapshot: undocumentedWhenExecuted }),
    ]);

    expect(view.cases[0].officialCase).toMatchObject({
      steps: [],
      expectedResult: '',
      documented: true,
    });
  });

  it.each([
    ['has steps only', { steps: ['A step'], expectedResult: '' }, true],
    ['has an expected result only', { steps: [], expectedResult: 'R' }, true],
    ['has neither', { steps: [], expectedResult: '' }, false],
  ])('is derived from the live case when it %s', (_label, live, expected) => {
    const view = toRunView(runRow(), [
      caseRow({ testCase: liveCase(live), catalogSnapshot: executedSnapshot }),
    ]);

    expect(view.cases[0].officialCase?.documented).toBe(expected);
  });
});

describe('toRunView officialCase without a usable catalog snapshot', () => {
  it.each([
    ['null (a row recorded before snapshots existed)', null],
    ['undefined', undefined],
    ['a string', 'not a snapshot'],
    [
      'an object missing the steps',
      { name: 'x', expectedResult: '', version: 1 },
    ],
    [
      'an object with a non-numeric version',
      { ...executedSnapshot, version: 'v2' },
    ],
  ])('falls back to the live case when the snapshot is %s', (_label, value) => {
    const view = toRunView(runRow(), [caseRow({ catalogSnapshot: value })]);

    expect(view.cases[0].officialCase).toMatchObject({
      name: 'Live catalog title',
      steps: ['Live step'],
      expectedResult: 'Live result',
      version: 5,
      executedVersion: 5,
    });
  });

  it('leaves officialCase null for a run case that is not linked to a catalog case', () => {
    const view = toRunView(runRow(), [
      caseRow({ testCaseId: null, testCase: null }),
    ]);

    expect(view.cases[0].officialCase).toBeNull();
  });

  it('leaves officialCase null when the live case was not selected', () => {
    const view = toRunView(runRow(), [caseRow({ testCase: undefined })]);

    expect(view.cases[0].officialCase).toBeNull();
  });
});
