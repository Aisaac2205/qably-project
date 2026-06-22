import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSuiteMetrics } from '@/features/suites/hooks/use-suite-metrics'
import { createMockSuite } from '@/lib/test-utils'
import { __resetStore, createRun } from '@/lib/mock-store'

describe('useSuiteMetrics', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('returns one entry per suite in the project', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'))
    expect(result.current.perSuite).toHaveLength(3)
    expect(result.current.perSuite.map((m) => m.suite.id)).toEqual([
      'suite-1',
      'suite-2',
      'suite-3',
    ])
  })

  it('returns empty arrays for a project with no suites', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-empty'))
    expect(result.current.perSuite).toEqual([])
    expect(result.current.projectMetrics.totalSuites).toBe(0)
    expect(result.current.projectMetrics.totalCases).toBe(0)
  })

  it('returns aggregated project metrics', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'))
    expect(result.current.projectMetrics.totalSuites).toBe(3)
    expect(result.current.projectMetrics.totalCases).toBe(3 + 3 + 1)
  })

  it('populates status, passRate7d, sparkline, lastRun for each suite', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'))
    const m1 = result.current.perSuite.find((m) => m.suite.id === 'suite-1')
    expect(m1).toBeDefined()
    expect(typeof m1!.status).toBe('string')
    expect(typeof m1!.passRate7d).toBe('number')
    expect(Array.isArray(m1!.sparkline)).toBe(true)
    expect(m1!.sparkline).toHaveLength(7)
  })

  it('memoizes per-suite metrics when runs reference is stable', () => {
    const { result, rerender } = renderHook(() => useSuiteMetrics('proj-1'))
    const before = result.current.perSuite
    rerender()
    const after = result.current.perSuite
    // Reference equality per suite: the perSuite array contents should be the same
    before.forEach((m, i) => {
      expect(after[i]).toBe(m)
    })
  })

  it('recomputes perSuite when a new run is added', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'))
    const beforeFirst = result.current.perSuite[0]
    expect(beforeFirst.lastRun).toBeDefined()

    act(() => {
      createRun({ projectId: 'proj-1', suiteId: 'suite-3', name: 'New Run' })
    })

    // After adding a run, the hook should reflect new state on next render
    const after = renderHook(() => useSuiteMetrics('proj-1'))
    const afterFirst = after.result.current.perSuite[0]
    // The reference should differ now (runs changed → recompute)
    expect(afterFirst).not.toBe(beforeFirst)
  })

  it('uses isDefault tag and description from the suite (no extra fields)', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'))
    const m1 = result.current.perSuite.find((m) => m.suite.id === 'suite-1')
    expect(m1!.suite.isDefault).toBe(true)
    expect(m1!.suite.description.length).toBeGreaterThan(0)
    expect(m1!.suite.tags.length).toBeGreaterThan(0)
  })

  it('reflects mock-store mutations across hook instances (useSyncExternalStore)', () => {
    // Render the hook once
    const { result: result1, unmount } = renderHook(() => useSuiteMetrics('proj-1'))
    const suitesBefore = result1.current.perSuite.length
    // Capture m1Old BEFORE the store mutates (result.current is a live getter that
    // updates on each render, so a later read would see the post-mutation value).
    const m1Old = result1.current.perSuite.find((m) => m.suite.id === 'suite-1')!

    // Mutate store directly: create a new run for suite-1
    act(() => {
      createRun({ projectId: 'proj-1', suiteId: 'suite-1', name: 'Hot' })
    })

    unmount()

    // Render a fresh hook: should see the new run reflected
    const { result: result2 } = renderHook(() => useSuiteMetrics('proj-1'))
    expect(result2.current.perSuite).toHaveLength(suitesBefore) // still 3 suites
    // suite-1 should have a different lastRun now
    const m1New = result2.current.perSuite.find((m) => m.suite.id === 'suite-1')!
    expect(m1New.lastRun).not.toBe(m1Old.lastRun)
    expect(m1New.lastRun?.id).not.toBe(m1Old.lastRun?.id)
  })
})

// Sanity: ensure createMockSuite is reachable from this test file
it('createMockSuite helper sanity', () => {
  const s = createMockSuite({ name: 'X' })
  expect(s.name).toBe('X')
  expect(s.description).toBeDefined()
  expect(s.tags).toEqual(['smoke', 'auth'])
})
