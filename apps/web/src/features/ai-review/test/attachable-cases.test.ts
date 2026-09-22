import { describe, it, expect } from 'vitest'
import type { Suite } from '@qably/types'
import { flattenAttachableCases } from '@/features/ai-review/lib/attachable-cases'

const suites: Suite[] = [
  {
    id: 'suite-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'Authentication',
    cases: [
      {
        id: 'tc-1',
        suiteId: 'suite-1',
        version: 1,
        name: 'Valid login redirects to dashboard',
        objective: '',
        preconditions: [],
        steps: [],
        expectedResult: '',
        priority: 'critical',
        state: 'active',
        executionMode: 'manual',
      },
    ],
    manualCases: 1,
    automatedCases: 0,
    undocumentedCount: 0,
    staleLocaleCount: 0,
    incompleteCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    description: '',
    tags: [],
    isDefault: true,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'suite-2',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'Checkout',
    cases: [
      {
        id: 'tc-2',
        suiteId: 'suite-2',
        version: 1,
        name: 'Checkout with empty cart blocked',
        objective: '',
        preconditions: [],
        steps: [],
        expectedResult: '',
        priority: 'high',
        state: 'active',
        executionMode: 'manual',
      },
    ],
    manualCases: 1,
    automatedCases: 0,
    undocumentedCount: 0,
    staleLocaleCount: 0,
    incompleteCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    description: '',
    tags: [],
    isDefault: false,
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

describe('flattenAttachableCases', () => {
  it('flattens every case in every suite with its suite name', () => {
    expect(flattenAttachableCases(suites)).toEqual([
      { id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' },
      { id: 'tc-2', name: 'Checkout with empty cart blocked', suiteName: 'Checkout' },
    ])
  })

  it('returns an empty list for no suites', () => {
    expect(flattenAttachableCases([])).toEqual([])
  })
})
