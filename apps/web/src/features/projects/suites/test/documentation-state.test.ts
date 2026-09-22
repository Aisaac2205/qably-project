import { describe, expect, it } from 'vitest'
import {
  isDocumentationBusy,
  isDocumenting,
  isOutcomeIncomplete,
} from '@/features/projects/suites/lib/documentation-state'

describe('isDocumenting', () => {
  it('is false when there is no documentation state', () => {
    expect(isDocumenting(undefined)).toBe(false)
  })

  it('is false when nothing was ever queued', () => {
    expect(isDocumenting({ queuedAt: null, outcomeAt: null })).toBe(false)
  })

  it('is true when queued and no outcome has landed yet', () => {
    expect(isDocumenting({ queuedAt: '2026-03-01T00:00:00Z', outcomeAt: null })).toBe(true)
  })

  it('is true when the queue timestamp is newer than the last outcome (re-queued)', () => {
    expect(
      isDocumenting({
        queuedAt: '2026-03-02T00:00:00Z',
        outcomeAt: '2026-03-01T00:00:00Z',
      }),
    ).toBe(true)
  })

  it('is false once the outcome lands after the queue timestamp', () => {
    expect(
      isDocumenting({
        queuedAt: '2026-03-01T00:00:00Z',
        outcomeAt: '2026-03-02T00:00:00Z',
      }),
    ).toBe(false)
  })
})

describe('isOutcomeIncomplete', () => {
  it('is false when there is no documentation state', () => {
    expect(isOutcomeIncomplete(undefined)).toBe(false)
  })

  it.each(['incomplete', 'skipped', 'failed'] as const)(
    'is true for outcome %s',
    (outcome) => {
      expect(isOutcomeIncomplete({ outcome })).toBe(true)
    },
  )

  it('is false for a complete outcome', () => {
    expect(isOutcomeIncomplete({ outcome: 'complete' })).toBe(false)
  })

  it('is false when there is no outcome yet', () => {
    expect(isOutcomeIncomplete({ outcome: null })).toBe(false)
  })
})

describe('isDocumentationBusy', () => {
  const idleState = { outcome: null, missing: [], skipReason: null, queuedAt: null, outcomeAt: null }

  it('is false for a suite with no cases and no suite-level documentation activity', () => {
    expect(
      isDocumentationBusy({ documentation: idleState, cases: [] } as never),
    ).toBe(false)
  })

  it('is true when the suite itself is being documented', () => {
    expect(
      isDocumentationBusy({
        documentation: { ...idleState, queuedAt: '2026-03-01T00:00:00Z' },
        cases: [],
      } as never),
    ).toBe(true)
  })

  it('is true when any case is being documented', () => {
    expect(
      isDocumentationBusy({
        documentation: idleState,
        cases: [
          { documentation: idleState },
          { documentation: { ...idleState, queuedAt: '2026-03-01T00:00:00Z' } },
        ],
      } as never),
    ).toBe(true)
  })

  it('is false when suite is undefined', () => {
    expect(isDocumentationBusy(undefined)).toBe(false)
  })
})
