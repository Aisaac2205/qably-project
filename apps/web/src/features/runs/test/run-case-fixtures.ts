import type { RunCaseOfficialCase, RunCaseRecord } from '@qably/types'

export const CI_RAW_NAME = 'useCreateRun > redirects to dashboard on valid login'
export const CI_FILE_PATH = 'src/features/runs/hooks/use-create-run.test.ts'
export const CI_HUMANIZED_TITLE = 'Redirects to dashboard on valid login'

export function automatedOfficialCase(
  overrides: Partial<RunCaseOfficialCase> = {},
): RunCaseOfficialCase {
  return {
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
    ...overrides,
  }
}

export function manualOfficialCase(
  overrides: Partial<RunCaseOfficialCase> = {},
): RunCaseOfficialCase {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    version: 3,
    name: 'Valid login redirects to dashboard',
    steps: ['Navigate to /login', 'Click Sign in'],
    expectedResult: 'Redirected to /dashboard',
    executionMode: 'manual',
    ...overrides,
  }
}

export function reportedRunCase(
  overrides: Partial<RunCaseRecord> = {},
): RunCaseRecord {
  return {
    id: 'run-case-9',
    testCaseId: 'case-9',
    officialCase: null,
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
  return {
    id: 'run-case-1',
    testCaseId: 'case-1',
    officialCase: null,
    name: 'Valid login redirects to dashboard',
    suiteName: 'Authentication',
    steps: ['Navigate to /login', 'Click Sign in'],
    expectedResult: 'Redirected to /dashboard',
    status: 'pending',
    position: 0,
    ...overrides,
  }
}
