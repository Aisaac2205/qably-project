import type {
  ConfirmDocumentationResult,
  DocumentFilesResult,
  Suite,
  TestCase,
} from '@qably/types'
import { mockSuites } from '@/lib/mock-data'
import type { CreateCasePayload, UpdateCasePayload } from '@/features/projects/suites/api/suites.api'

let suites: Suite[] = structuredClone(mockSuites)
let caseIdCounter = 0

export function __resetSuitesStub(): void {
  suites = structuredClone(mockSuites)
  caseIdCounter = 0
}

export function listSuites(projectId?: string): Promise<Suite[]> {
  return Promise.resolve(
    projectId === undefined
      ? suites
      : suites.filter((suite) => suite.projectId === projectId),
  )
}

export function getSuite(id: string): Promise<Suite> {
  const found = suites.find((suite) => suite.id === id)

  return found === undefined
    ? Promise.reject(new Error(`suite ${id} not found`))
    : Promise.resolve(found)
}

export function createSuite(payload: {
  projectId: string
  name: string
  description?: string
  tags?: string[]
}): Promise<Suite> {
  const created: Suite = {
    id: `suite-${suites.length + 1}`,
    projectId: payload.projectId,
    organizationId: 'org-1',
    name: payload.name,
    cases: [],
    manualCases: 0,
    automatedCases: 0,
    undocumentedCount: 0,
    staleLocaleCount: 0,
    incompleteCount: 0,
    description: payload.description ?? '',
    tags: payload.tags ?? [],
    isDefault: false,
    createdAt: '2026-01-25T00:00:00Z',
    updatedAt: '2026-01-25T00:00:00Z',
  }
  suites = [...suites, created]

  return Promise.resolve(created)
}

export function updateSuite(
  id: string,
  patch: Partial<Suite>,
): Promise<Suite> {
  const updated = { ...suites.find((suite) => suite.id === id)!, ...patch }
  suites = suites.map((suite) => (suite.id === id ? updated : suite))

  return Promise.resolve(updated)
}

export function deleteSuite(id: string): Promise<void> {
  suites = suites.filter((suite) => suite.id !== id)

  return Promise.resolve()
}

export function createCase(
  suiteId: string,
  payload: CreateCasePayload,
): Promise<Suite> {
  const suite = suites.find((s) => s.id === suiteId)
  if (suite === undefined) {
    return Promise.reject(new Error(`suite ${suiteId} not found`))
  }
  caseIdCounter += 1
  const created: TestCase = {
    id: `case-${caseIdCounter}`,
    suiteId,
    version: null,
    name: payload.name,
    objective: payload.objective ?? '',
    preconditions: payload.preconditions ?? [],
    steps: payload.steps ?? [],
    expectedResult: payload.expectedResult ?? '',
    priority: payload.priority ?? 'medium',
    state: payload.state ?? 'active',
    executionMode: 'manual',
  }
  const updated = { ...suite, cases: [...suite.cases, created] }
  suites = suites.map((s) => (s.id === suiteId ? updated : s))

  return Promise.resolve(updated)
}

export function updateCase(
  suiteId: string,
  caseId: string,
  patch: UpdateCasePayload,
): Promise<Suite> {
  const suite = suites.find((s) => s.id === suiteId)
  if (suite === undefined) {
    return Promise.reject(new Error(`suite ${suiteId} not found`))
  }
  const updated = {
    ...suite,
    cases: suite.cases.map((c) => (c.id === caseId ? { ...c, ...patch } : c)),
  }
  suites = suites.map((s) => (s.id === suiteId ? updated : s))

  return Promise.resolve(updated)
}

export function deleteCase(suiteId: string, caseId: string): Promise<Suite> {
  const suite = suites.find((s) => s.id === suiteId)
  if (suite === undefined) {
    return Promise.reject(new Error(`suite ${suiteId} not found`))
  }
  const updated = { ...suite, cases: suite.cases.filter((c) => c.id !== caseId) }
  suites = suites.map((s) => (s.id === suiteId ? updated : s))

  return Promise.resolve(updated)
}

export function documentCase(): Promise<{ queued: true; jobId: string }> {
  return Promise.resolve({ queued: true, jobId: 'job-1' })
}

export function documentSuite(): Promise<DocumentFilesResult> {
  return Promise.resolve({
    filesEnqueued: 0,
    casesTargeted: 0,
    casesSkipped: [],
  })
}

export function documentProject(): Promise<DocumentFilesResult> {
  return Promise.resolve({
    filesEnqueued: 0,
    casesTargeted: 0,
    casesSkipped: [],
  })
}

export function confirmDocumentation(
  suiteId: string,
): Promise<ConfirmDocumentationResult> {
  return Promise.resolve({
    suiteId,
    confirmedCaseIds: [],
    confirmedCount: 0,
    skippedCaseIds: [],
    skippedCount: 0,
    documentationConfirmedAt: '2026-09-12T10:00:00.000Z',
    documentationConfirmedById: 'user-1',
  })
}
