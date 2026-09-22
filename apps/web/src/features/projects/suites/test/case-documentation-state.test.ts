import { describe, expect, it } from 'vitest'
import type { TestCase } from '@qably/types'
import { deriveCaseDocumentationBadge } from '@/features/projects/suites/lib/case-documentation-state'
import { createMockTestCase } from '@/lib/test-utils'

function testCase(overrides: Partial<TestCase> = {}): TestCase {
  return createMockTestCase(overrides)
}

describe('deriveCaseDocumentationBadge', () => {
  it('returns null when the case carries no documentation state', () => {
    expect(deriveCaseDocumentationBadge(testCase())).toBeNull()
  })

  it('returns null when the documentation state is idle and complete', () => {
    const subject = testCase({
      documentation: {
        outcome: 'complete',
        missing: [],
        skipReason: null,
        queuedAt: null,
        outcomeAt: null,
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toBeNull()
  })

  it('reports documenting while queued with no outcome yet', () => {
    const subject = testCase({
      documentation: {
        outcome: null,
        missing: [],
        skipReason: null,
        queuedAt: '2026-03-01T00:00:00Z',
        outcomeAt: null,
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({ kind: 'documenting' })
  })

  it('reports documenting when re-queued after a previous outcome', () => {
    const subject = testCase({
      documentation: {
        outcome: 'failed',
        missing: [],
        skipReason: null,
        queuedAt: '2026-03-02T00:00:00Z',
        outcomeAt: '2026-03-01T00:00:00Z',
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({ kind: 'documenting' })
  })

  it('reports incomplete with the missing fields once documenting settles', () => {
    const subject = testCase({
      documentation: {
        outcome: 'incomplete',
        missing: ['objective', 'steps'],
        skipReason: null,
        queuedAt: null,
        outcomeAt: '2026-03-01T00:00:00Z',
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({
      kind: 'incomplete',
      missing: ['objective', 'steps'],
    })
  })

  it('reports skipped with the reason', () => {
    const subject = testCase({
      documentation: {
        outcome: 'skipped',
        missing: [],
        skipReason: 'no-source-file',
        queuedAt: null,
        outcomeAt: '2026-03-01T00:00:00Z',
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({
      kind: 'skipped',
      reason: 'no-source-file',
    })
  })

  it('falls back to a generic reason when the skip reason is not one of the known values', () => {
    const subject = testCase({
      documentation: {
        outcome: 'skipped',
        missing: [],
        skipReason: 'a-future-reason-this-build-does-not-know-about',
        queuedAt: null,
        outcomeAt: '2026-03-01T00:00:00Z',
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({
      kind: 'skipped',
      reason: 'unknown',
    })
  })

  it('reports failed', () => {
    const subject = testCase({
      documentation: {
        outcome: 'failed',
        missing: [],
        skipReason: null,
        queuedAt: null,
        outcomeAt: '2026-03-01T00:00:00Z',
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({ kind: 'failed' })
  })

  it('prioritizes documenting over a stale incomplete outcome', () => {
    const subject = testCase({
      documentation: {
        outcome: 'incomplete',
        missing: ['title'],
        skipReason: null,
        queuedAt: '2026-03-02T00:00:00Z',
        outcomeAt: '2026-03-01T00:00:00Z',
      },
    })

    expect(deriveCaseDocumentationBadge(subject)).toEqual({ kind: 'documenting' })
  })
})
