import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_KPI_POLARITY,
  resolveKpiDeltaTone,
} from '@/features/dashboard/lib/kpi-delta'

describe('resolveKpiDeltaTone', () => {
  it('reads a higher pass rate as better', () => {
    expect(resolveKpiDeltaTone(0.9, 0.8, 'higher-is-better')).toBe('better')
  })

  it('reads a lower pass rate as worse', () => {
    expect(resolveKpiDeltaTone(0.7, 0.8, 'higher-is-better')).toBe('worse')
  })

  it('reads fewer failed cases as better even though the value dropped', () => {
    expect(resolveKpiDeltaTone(4, 9, 'lower-is-better')).toBe('better')
  })

  it('reads more failed cases as worse', () => {
    expect(resolveKpiDeltaTone(12, 9, 'lower-is-better')).toBe('worse')
  })

  it('reads an unchanged value as neutral', () => {
    expect(resolveKpiDeltaTone(10, 10, 'higher-is-better')).toBe('neutral')
  })

  it('reads a null current value as neutral', () => {
    expect(resolveKpiDeltaTone(null, 0.8, 'higher-is-better')).toBe('neutral')
  })

  it('reads a null previous value as neutral', () => {
    expect(resolveKpiDeltaTone(0.8, null, 'higher-is-better')).toBe('neutral')
  })

  it('pins passRate and runs as higher-is-better, failedCases and avgRunDurationMs as lower-is-better', () => {
    expect(DASHBOARD_KPI_POLARITY).toEqual({
      passRate: 'higher-is-better',
      runs: 'higher-is-better',
      failedCases: 'lower-is-better',
      avgRunDurationMs: 'lower-is-better',
    })
  })
})
