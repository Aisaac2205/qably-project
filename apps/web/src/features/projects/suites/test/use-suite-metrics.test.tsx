import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { useSuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { createTestQueryClient, withQueryClient } from '@/lib/query-test-utils'
import { runKeys } from '@/features/runs/lib/query-keys'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

describe('useSuiteMetrics', () => {
  it('returns one entry per suite in the project', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => withQueryClient(children),
    })

    expect(result.current.perSuite).toHaveLength(4)
    expect(result.current.perSuite.map((m) => m.suite.id)).toEqual([
      'suite-1',
      'suite-2',
      'suite-3',
      'suite-4',
    ])
  })

  it('returns an empty perSuite for a project with no suites, without loading forever', async () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-empty'), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    await act(async () => {})
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.perSuite).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('populates status, recentPassRate, sparkline, lastRun for each suite', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => withQueryClient(children),
    })

    const m1 = result.current.perSuite.find((m) => m.suite.id === 'suite-1')
    expect(m1).toBeDefined()
    expect(typeof m1!.status).toBe('string')
    expect(typeof m1!.recentPassRate).toBe('number')
    expect(Array.isArray(m1!.sparkline)).toBe(true)
    expect(m1!.lastRun?.id).toBe('run-12')
  })

  it('reports never-run for a suite with no runs', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => withQueryClient(children),
    })

    const m3 = result.current.perSuite.find((m) => m.suite.id === 'suite-3')
    expect(m3?.status).toBe('never-run')
    expect(m3?.lastRun).toBeUndefined()
  })

  it('memoizes per-suite metrics when the underlying data is stable', () => {
    const { result, rerender } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    const before = result.current.perSuite
    rerender()
    const after = result.current.perSuite

    before.forEach((m, i) => {
      expect(after[i]).toBe(m)
    })
  })

  it('recomputes perSuite when the suite-metrics cache changes', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    await act(async () => {})

    const beforeFirst = result.current.perSuite[0]
    expect(beforeFirst.lastRun).toBeDefined()

    await act(async () => {
      client.setQueryData(runKeys.suiteMetrics('proj-1'), {
        items: [
          {
            suiteId: 'suite-1',
            lastRun: {
              id: 'run-hot',
              status: 'pass',
              source: 'manual',
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              passRate: 1,
            },
            trend: ['pass'],
          },
        ],
      })
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const afterFirst = result.current.perSuite[0]
    expect(afterFirst.lastRun?.id).toBe('run-hot')
    expect(afterFirst).not.toBe(beforeFirst)
  })

  it('uses isDefault tag and description from the suite (no extra fields)', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => withQueryClient(children),
    })

    const m1 = result.current.perSuite.find((m) => m.suite.id === 'suite-1')
    expect(m1!.suite.isDefault).toBe(true)
    expect(m1!.suite.description.length).toBeGreaterThan(0)
    expect(m1!.suite.tags.length).toBeGreaterThan(0)
  })
})
