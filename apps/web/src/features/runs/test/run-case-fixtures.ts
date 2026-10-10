import type { RunCaseOfficialCase, RunCaseRecord } from '@qably/types'

export const CI_RAW_NAME = 'useCreateRun > redirects to dashboard on valid login'
export const CI_FILE_PATH = 'src/features/runs/hooks/use-create-run.test.ts'
export const CI_HUMANIZED_TITLE = 'Redirects to dashboard on valid login'

type OfficialCaseBase = Omit<RunCaseOfficialCase, 'executedVersion' | 'documented'>

// By default the run executed the library case as it stands, so the executed
// version and the documented flag follow the case. A test that needs the library
// to have moved on since the run states them explicitly.
function withLiveState(
  base: OfficialCaseBase,
  overrides: Partial<RunCaseOfficialCase>,
): RunCaseOfficialCase {
  const merged = { ...base, ...overrides }

  return {
    ...merged,
    executedVersion: overrides.executedVersion === undefined ? merged.version : overrides.executedVersion,
    documented: overrides.documented ?? (merged.steps.length > 0 || merged.expectedResult !== ''),
  }
}

export function automatedOfficialCase(
  overrides: Partial<RunCaseOfficialCase> = {},
): RunCaseOfficialCase {
  return withLiveState(
    {
      id: 'case-9',
      suiteId: 'suite-1',
      version: null,
      name: 'Redirige al panel con credenciales válidas',
      steps: [],
      expectedResult: '',
      executionMode: 'automated',
      automationKey: `${CI_FILE_PATH}::${CI_RAW_NAME}`,
      automationClassName: CI_FILE_PATH,
      automationFilePath: CI_FILE_PATH,
    },
    overrides,
  )
}

export function manualOfficialCase(
  overrides: Partial<RunCaseOfficialCase> = {},
): RunCaseOfficialCase {
  return withLiveState(
    {
      id: 'case-1',
      suiteId: 'suite-1',
      version: 3,
      name: 'Valid login redirects to dashboard',
      steps: ['Navigate to /login', 'Click Sign in'],
      expectedResult: 'Redirected to /dashboard',
      executionMode: 'manual',
    },
    overrides,
  )
}

export function reportedRunCase(
  overrides: Partial<RunCaseRecord> = {},
): RunCaseRecord {
  const officialCase = overrides.officialCase ?? null

  return {
    id: 'run-case-9',
    testCaseId: officialCase?.id ?? null,
    officialCase,
    name: CI_RAW_NAME,
    suiteName: 'Auth',
    steps: [],
    expectedResult: '',
    status: 'pass',
    position: 0,
    recordedAt: '2026-10-05T10:00:00.000Z',
    className: CI_FILE_PATH,
    filePath: CI_FILE_PATH,
    durationMs: 120,
    ...overrides,
  }
}

export function snapshotRunCase(
  overrides: Partial<RunCaseRecord> = {},
): RunCaseRecord {
  const officialCase = overrides.officialCase ?? null

  return {
    id: 'run-case-1',
    testCaseId: officialCase?.id ?? null,
    officialCase,
    name: 'Valid login redirects to dashboard',
    suiteName: 'Authentication',
    steps: ['Navigate to /login', 'Click Sign in'],
    expectedResult: 'Redirected to /dashboard',
    status: 'pending',
    position: 0,
    ...overrides,
  }
}
