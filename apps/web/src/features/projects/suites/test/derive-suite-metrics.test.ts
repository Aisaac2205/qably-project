import { describe, it, expect } from 'vitest'
import type { Suite, SuiteMetricsEntry } from '@qably/types'
import { deriveSuiteMetrics } from '@/features/projects/suites/lib/derive-suite-metrics'

function suite(overrides: Partial<Suite> = {}): Suite {
  return {
    id: 'suite-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'Checkout',
    cases: [],
    manualCases: 0,
    automatedCases: 0,
    staleLocaleCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    description: '',
    tags: [],
    isDefault: false,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('deriveSuiteMetrics', () => {
  it('reports never-run and an empty sparkline when the suite has no entry', () => {
    const result = deriveSuiteMetrics(suite(), undefined)

    expect(result.status).toBe('never-run')
    expect(result.lastRun).toBeUndefined()
    expect(result.recentPassRate).toBe(0)
    expect(result.sparkline).toEqual([])
  })

  it('reports never-run when the entry has a null lastRun', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: null,
      trend: [],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.status).toBe('never-run')
  })

  it('carries the lastRun fields through unchanged', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-1',
        status: 'pass',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        finishedAt: '2026-01-02T00:05:00Z',
        passRate: 1,
      },
      trend: ['pass'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.lastRun).toEqual(entry.lastRun)
  })

  it('reports running when any trend entry is running, even if the last one finished', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-2',
        status: 'pass',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        passRate: 1,
      },
      trend: ['running', 'pass'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.status).toBe('running')
  })

  it('computes recentPassRate from the completed entries in the trend', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-2',
        status: 'pass',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        passRate: 1,
      },
      trend: ['fail', 'pass', 'pass'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.recentPassRate).toBe(67)
  })

  it('reports needs-attention when the completed pass rate is below 70', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-1',
        status: 'fail',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        passRate: 0,
      },
      trend: ['fail', 'fail', 'pass'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.status).toBe('needs-attention')
  })

  it('reports pass when the most recent completed entry passed and the rate clears the threshold', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-1',
        status: 'pass',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        passRate: 1,
      },
      trend: ['pass', 'pass', 'pass'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.status).toBe('pass')
  })

  it('reports fail when the most recent completed entry failed and the rate clears the threshold', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-1',
        status: 'fail',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        passRate: 0,
      },
      trend: ['pass', 'pass', 'pass', 'fail'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.status).toBe('fail')
  })

  it('builds an oldest-first sparkline from only the completed trend entries', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-3',
        status: 'pass',
        source: 'manual',
        startedAt: '2026-01-03T00:00:00Z',
        passRate: 1,
      },
      trend: ['running', 'fail', 'pass'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.sparkline.map((p) => p.passRate)).toEqual([0, 100])
  })

  it('excludes non-terminal trend statuses when computing needs-attention with zero completed runs', () => {
    const entry: SuiteMetricsEntry = {
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      lastRun: {
        id: 'run-1',
        status: 'pending',
        source: 'manual',
        startedAt: '2026-01-02T00:00:00Z',
        passRate: 0,
      },
      trend: ['pending'],
    }

    const result = deriveSuiteMetrics(suite(), entry)

    expect(result.status).toBe('needs-attention')
    expect(result.recentPassRate).toBe(0)
  })

  it('keeps the suite object as-is on the result', () => {
    const s = suite({ name: 'Payments' })

    const result = deriveSuiteMetrics(s, undefined)

    expect(result.suite).toBe(s)
  })
})
