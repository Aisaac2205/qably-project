import type { Suite } from '@qably/types'
import { mockSuites } from '@/lib/mock-data'

let suites: Suite[] = structuredClone(mockSuites)

export function __resetSuitesStub(): void {
  suites = structuredClone(mockSuites)
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

export function createCase(suiteId: string): Promise<Suite> {
  return getSuite(suiteId)
}

export function updateCase(suiteId: string): Promise<Suite> {
  return getSuite(suiteId)
}

export function deleteCase(suiteId: string): Promise<Suite> {
  return getSuite(suiteId)
}
