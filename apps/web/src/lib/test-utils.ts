import type { Suite, TestCase } from '@qably/types'

/**
 * Build a valid Suite fixture for tests.
 *
 * Defaults match a minimal realistic suite; pass `overrides` to specialize.
 * New required fields (description, tags, isDefault, updatedAt) are pre-filled
 * with safe values so existing tests don't need to repeat them.
 */
export function createMockSuite(overrides: Partial<Suite> = {}): Suite {
  const cases: TestCase[] = overrides.cases ?? []
  return {
    id: overrides.id ?? 'suite-1',
    projectId: overrides.projectId ?? 'proj-1',
    organizationId: overrides.organizationId ?? 'org-1',
    name: overrides.name ?? 'Authentication',
    cases,
    createdAt: overrides.createdAt ?? '2026-01-25T00:00:00Z',
    description: overrides.description ?? 'Login and password flows.',
    tags: overrides.tags ?? ['smoke', 'auth'],
    isDefault: overrides.isDefault ?? false,
    updatedAt: overrides.updatedAt ?? '2026-01-25T00:00:00Z',
  }
}
