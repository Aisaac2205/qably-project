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
  const manualCases =
    overrides.manualCases ?? cases.filter((c) => c.executionMode !== 'automated').length
  const automatedCases =
    overrides.automatedCases ?? cases.filter((c) => c.executionMode === 'automated').length
  const staleLocaleCount =
    overrides.staleLocaleCount ??
    cases.filter((c) => c.executionMode === 'automated' && c.localeStale === true).length
  const undocumentedCount =
    overrides.undocumentedCount ??
    cases.filter((c) => c.executionMode === 'automated' && c.steps.length === 0)
      .length
  return {
    id: overrides.id ?? 'suite-1',
    projectId: overrides.projectId ?? 'proj-1',
    organizationId: overrides.organizationId ?? 'org-1',
    name: overrides.name ?? 'Authentication',
    cases,
    manualCases,
    automatedCases,
    undocumentedCount,
    staleLocaleCount,
    createdAt: overrides.createdAt ?? '2026-01-25T00:00:00Z',
    description: overrides.description ?? 'Login and password flows.',
    tags: overrides.tags ?? ['smoke', 'auth'],
    isDefault: overrides.isDefault ?? false,
    updatedAt: overrides.updatedAt ?? '2026-01-25T00:00:00Z',
    healthSummary: overrides.healthSummary,
  }
}

/**
 * Build a valid TestCase fixture for tests.
 *
 * Defaults to a manual, active, medium-priority case. Pass `executionMode:
 * 'automated'` with `automationKey` (and optionally `automationClassName` /
 * `automationFilePath`) to model a CI-discovered case.
 */
export function createMockTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: overrides.id ?? 'tc-1',
    suiteId: overrides.suiteId ?? 'suite-1',
    version: overrides.version ?? null,
    name: overrides.name ?? 'Valid login redirects to dashboard',
    steps: overrides.steps ?? [],
    expectedResult: overrides.expectedResult ?? '',
    priority: overrides.priority ?? 'medium',
    state: overrides.state ?? 'active',
    executionMode: overrides.executionMode ?? 'manual',
    automationKey: overrides.automationKey,
    automationClassName: overrides.automationClassName,
    automationFilePath: overrides.automationFilePath,
    lastResult: overrides.lastResult,
    healthSignals: overrides.healthSignals,
    documentedLocale: overrides.documentedLocale,
    localeStale: overrides.localeStale,
  }
}
