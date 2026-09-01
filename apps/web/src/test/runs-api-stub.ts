import type {
  CaseStatus,
  RunCaseCounts,
  RunCaseRecord,
  RunRecord,
  RunSummaryRecord,
} from '@qably/types'

function countCases(cases: RunCaseRecord[]): RunCaseCounts {
  const counts: RunCaseCounts = {
    total: cases.length,
    pending: 0,
    running: 0,
    pass: 0,
    fail: 0,
    skip: 0,
    blocked: 0,
  }
  for (const c of cases) counts[c.status]++
  return counts
}

function passRateOf(counts: RunCaseCounts): number {
  return counts.total === 0 ? 0 : counts.pass / counts.total
}

function caseRecord(
  id: string,
  name: string,
  suiteName: string,
  status: CaseStatus,
  position: number,
  overrides: Partial<RunCaseRecord> = {},
): RunCaseRecord {
  return {
    id,
    testCaseId: id,
    name,
    suiteName,
    steps: [],
    expectedResult: '',
    status,
    position,
    ...overrides,
  }
}

const run12Cases: RunCaseRecord[] = [
  caseRecord('tc-1', 'Valid login redirects to dashboard', 'Authentication', 'pass', 0, {
    steps: ['Navigate to /login', 'Enter valid email and password', 'Click Sign in'],
    expectedResult: 'Redirected to /dashboard within 1 second',
  }),
  caseRecord('tc-2', 'Invalid credentials shows error', 'Authentication', 'pass', 1, {
    steps: ['Navigate to /login', 'Enter invalid credentials', 'Click Sign in'],
    expectedResult: 'Error message "Invalid email or password" is visible',
  }),
  caseRecord('tc-3', 'Reset password flow', 'Authentication', 'fail', 2, {
    steps: ['Click Forgot password', 'Enter registered email', 'Click Send reset link'],
    expectedResult: 'Success message and email received',
  }),
  caseRecord('tc-4', 'Checkout with empty cart blocked', 'Checkout', 'running', 3, {
    steps: ['Navigate to /checkout with empty cart', 'Observe checkout button state'],
    expectedResult: 'Checkout button is disabled and "Your cart is empty" message shown',
  }),
  caseRecord('tc-5', 'Discount code applied correctly', 'Checkout', 'pending', 4, {
    steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Observe total'],
    expectedResult: 'Total is reduced by 20%',
  }),
  caseRecord('tc-6', 'Out of stock prevents add to cart', 'Checkout', 'pending', 5, {
    steps: ['Find out-of-stock product', 'Attempt to add to cart'],
    expectedResult: '"Out of stock" label shown, add button disabled',
  }),
]

const run11Cases: RunCaseRecord[] = [
  caseRecord('tc-11-1', 'Session persists across reload', 'Authentication', 'pass', 0),
]

const run10Cases: RunCaseRecord[] = [
  caseRecord('tc-10-1', 'Empty cart blocks checkout', 'Checkout', 'pass', 0),
  caseRecord('tc-10-2', 'Discount code applies correctly', 'Checkout', 'pass', 1),
  caseRecord('tc-10-3', 'Checkout button re-enables after fix', 'Checkout', 'fail', 2),
]

const run9Cases: RunCaseRecord[] = [
  caseRecord('tc-9-1', 'Out of stock item cannot be purchased', 'Checkout', 'pass', 0),
]

export const runFixtures: RunRecord[] = [
  {
    id: 'run-12',
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    name: 'Run #12',
    status: 'running',
    source: 'manual',
    externalId: '',
    startedAt: '2026-06-16T10:00:00Z',
    cases: run12Cases,
  },
  {
    id: 'run-11',
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    name: 'Run #11',
    status: 'pass',
    source: 'manual',
    externalId: '',
    startedAt: '2026-06-15T14:30:00Z',
    finishedAt: '2026-06-15T14:38:00Z',
    cases: run11Cases,
  },
  {
    id: 'run-10',
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-2',
    name: 'Run #10',
    status: 'fail',
    source: 'github_actions',
    externalId: 'gh-run-10',
    startedAt: '2026-06-14T09:00:00Z',
    finishedAt: '2026-06-14T09:12:00Z',
    commitSha: 'b1e4d90',
    commitMessage: 'fix: checkout button not disabling on empty cart',
    commitAuthor: 'CI Bot',
    cases: run10Cases,
  },
  {
    id: 'run-9',
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-2',
    name: 'Run #9',
    status: 'pass',
    source: 'api',
    externalId: 'api-run-9',
    startedAt: '2026-06-13T11:00:00Z',
    finishedAt: '2026-06-13T11:08:00Z',
    cases: run9Cases,
  },
]

function toSummary(run: RunRecord): RunSummaryRecord {
  const caseCounts = countCases(run.cases)
  return {
    id: run.id,
    projectId: run.projectId,
    organizationId: run.organizationId,
    suiteId: run.suiteId,
    name: run.name,
    status: run.status,
    source: run.source,
    externalId: run.externalId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    executedById: run.executedById,
    commitSha: run.commitSha,
    commitMessage: run.commitMessage,
    commitAuthor: run.commitAuthor,
    caseCounts,
    passRate: passRateOf(caseCounts),
  }
}

let runs: RunRecord[] = structuredClone(runFixtures)

export function __resetRunsStub(): void {
  runs = structuredClone(runFixtures)
}

export function listRuns(projectId?: string): Promise<RunSummaryRecord[]> {
  const filtered = projectId === undefined
    ? runs
    : runs.filter((run) => run.projectId === projectId)

  return Promise.resolve(
    [...filtered]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .map(toSummary),
  )
}

export function getRun(id: string): Promise<RunRecord> {
  const found = runs.find((run) => run.id === id)

  return found === undefined
    ? Promise.reject(new Error(`run ${id} not found`))
    : Promise.resolve(found)
}

export function createRun(payload: {
  projectId: string
  suiteId: string
  name?: string
}): Promise<RunRecord> {
  const created: RunRecord = {
    id: `run-${runs.length + 1}`,
    projectId: payload.projectId,
    organizationId: 'org-1',
    suiteId: payload.suiteId,
    name: payload.name ?? 'New run',
    status: 'pending',
    source: 'manual',
    externalId: '',
    startedAt: '2026-06-17T00:00:00Z',
    cases: [],
  }
  runs = [created, ...runs]

  return Promise.resolve(created)
}

export function updateRunCase(
  runId: string,
  caseId: string,
  payload: { status: CaseStatus },
): Promise<RunRecord> {
  const target = runs.find((run) => run.id === runId)
  if (target === undefined) {
    return Promise.reject(new Error(`run ${runId} not found`))
  }

  const updated: RunRecord = {
    ...target,
    cases: target.cases.map((c) =>
      c.id === caseId ? { ...c, status: payload.status, recordedAt: '2026-06-17T00:00:00Z' } : c,
    ),
  }
  runs = runs.map((run) => (run.id === runId ? updated : run))

  return Promise.resolve(updated)
}
