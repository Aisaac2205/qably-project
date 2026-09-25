import { describe, expect, it } from 'vitest'
import {
  classificationReasonKey,
  classificationScorePercent,
  resolveClassification,
} from '@/features/review-inbox/lib/classification-reason'

describe('classificationReasonKey', () => {
  it('maps same-automation-key to its i18n key', () => {
    expect(classificationReasonKey('same-automation-key')).toBe(
      'classificationReasonSameAutomationKey',
    )
  })

  it('maps steps-overlap to a different i18n key', () => {
    expect(classificationReasonKey('steps-overlap')).toBe('classificationReasonStepsOverlap')
  })

  it('maps every known reason to a distinct, non-empty key', () => {
    const reasons = [
      'same-automation-key',
      'same-title',
      'title-overlap',
      'steps-overlap',
      'expected-result-overlap',
      'cross-suite-key',
    ] as const

    const keys = reasons.map(classificationReasonKey)

    expect(new Set(keys).size).toBe(reasons.length)
    for (const key of keys) expect(key.length).toBeGreaterThan(0)
  })
})

describe('classificationScorePercent', () => {
  it('converts a fractional score to a rounded whole percent', () => {
    expect(classificationScorePercent(0.723)).toBe(72)
  })

  it('rounds a different score to a different percent', () => {
    expect(classificationScorePercent(0.5)).toBe(50)
  })

  it('returns null when the score is null', () => {
    expect(classificationScorePercent(null)).toBeNull()
  })
})

describe('resolveClassification', () => {
  it('defaults to kind none with no reasons when classification is undefined', () => {
    expect(resolveClassification(undefined)).toEqual({
      kind: 'none',
      matchedCaseId: null,
      score: null,
      reasons: [],
    })
  })

  it('passes through a real classification unchanged', () => {
    const classification = {
      kind: 'possible_duplicate' as const,
      matchedCaseId: 'case-1',
      score: 0.72,
      reasons: ['same-title' as const],
    }

    expect(resolveClassification(classification)).toBe(classification)
  })
})
