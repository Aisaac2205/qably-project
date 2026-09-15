import { describe, expect, it } from 'vitest'
import { TONE_TEXT_CLASSES, toneForPassRatePercent } from '@/features/projects/quality/lib/tone'

describe('toneForPassRatePercent', () => {
  it('returns pass at and above the 70% threshold', () => {
    expect(toneForPassRatePercent(70)).toBe('pass')
    expect(toneForPassRatePercent(100)).toBe('pass')
  })

  it('returns warn between 0 (exclusive) and 70 (exclusive)', () => {
    expect(toneForPassRatePercent(69)).toBe('warn')
    expect(toneForPassRatePercent(1)).toBe('warn')
  })

  it('returns fail at exactly 0', () => {
    expect(toneForPassRatePercent(0)).toBe('fail')
  })
})

describe('TONE_TEXT_CLASSES', () => {
  it('maps every tone to its status text token class', () => {
    expect(TONE_TEXT_CLASSES.pass).toBe('text-pass')
    expect(TONE_TEXT_CLASSES.warn).toBe('text-warn')
    expect(TONE_TEXT_CLASSES.fail).toBe('text-fail')
  })
})
