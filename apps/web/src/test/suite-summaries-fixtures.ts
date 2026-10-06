import type { RunStatus, Suite } from '@qably/types'
import { createMockSuite, createMockTestCase } from '@/lib/test-utils'
import type { SuiteRunSource } from '@/test/suite-summaries-stub'

export const PROJECT = 'proj-1'

export function suite(id: string, overrides: Partial<Suite> = {}): Suite {
  return createMockSuite({
    id,
    projectId: PROJECT,
    name: `Suite ${id}`,
    description: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

export function run(
  id: string,
  suiteId: string,
  status: RunStatus,
  startedAt: string,
): SuiteRunSource {
  return { id, suiteId, status, startedAt }
}

export function casesOf(count: number) {
  return Array.from({ length: count }, (_, index) =>
    createMockTestCase({ id: `case-${index}`, suiteId: 'any' }),
  )
}

export function numbered(count: number): Suite[] {
  return Array.from({ length: count }, (_, index) =>
    suite(`s${String(index).padStart(3, '0')}`, {
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    }),
  )
}

export function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id)
}
