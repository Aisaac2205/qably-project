import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { useSuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { createMockSuite } from '@/lib/test-utils'
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
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), { wrapper: ({ children }) => withQueryClient(children) })
    expect(result.current.perSuite).toHaveLength(4)
    expect(result.current.perSuite.map((m) => m.suite.id)).toEqual([
      'suite-1',
      'suite-2',
      'suite-3',
      'suite-4',
    ])
  })

  it('returns empty arrays for a project with no suites', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-empty'), { wrapper: ({ children }) => withQueryClient(children) })
    expect(result.current.perSuite).toEqual([])
    expect(result.current.projectMetrics.totalSuites).toBe(0)
    expect(result.current.projectMetrics.totalCases).toBe(0)
  })

  it('returns aggregated project metrics', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), { wrapper: ({ children }) => withQueryClient(children) })
    expect(result.current.projectMetrics.totalSuites).toBe(4)
    expect(result.current.projectMetrics.totalCases).toBe(3 + 3 + 1)
  })

  it('populates status, passRate7d, sparkline, lastRun for each suite', () => {
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), { wrapper: ({ children }) => withQueryClient(children) })
    const m1 = result.current.perSuite.find((m) => m.suite.id === 'suite-1')
    expect(m1).toBeDefined()
    expect(typeof m1!.status).toBe('string')
    expect(typeof m1!.passRate7d).toBe('number')
    expect(Array.isArray(m1!.sparkline)).toBe(true)
    expect(m1!.sparkline).toHaveLength(7)
  })

  it('memoizes per-suite metrics when runs reference is stable', () => {
    const { result, rerender } = renderHook(() => useSuiteMetrics('proj-1'), { wrapper: ({ children }) => withQueryClient(children) })
    const before = result.current.perSuite
    rerender()
    const after = result.current.perSuite
    // Reference equality per suite: the perSuite array contents should be the same
    before.forEach((m, i) => {
      expect(after[i]).toBe(m)
    })
  })

  it('recomputes perSuite when the runs cache changes', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    // Let the initial mount's background refetch (staleTime: 0) settle before
    // asserting, otherwise it can race the cache write below and clobber it.
    await act(async () => {})

    const beforeFirst = result.current.perSuite[0]
    expect(beforeFirst.lastRun).toBeDefined()

    await act(async () => {
      const existing =
        client.getQueryData<{ items: Array<{ id: string }> }>(
          runKeys.list('proj-1'),
        )?.items ?? []
      client.setQueryData(runKeys.list('proj-1'), {
        items: [
        {
          id: 'run-hot',
          projectId: 'proj-1',
          organizationId: 'org-1',
          suiteId: 'suite-1',
          suiteName: 'Authentication',
          name: 'Hot run',
          status: 'pass',
          source: 'manual',
          externalId: '',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          caseCounts: { total: 1, pending: 0, running: 0, pass: 1, fail: 0, skip: 0, blocked: 0 },
          passRate: 1,
        },
        ...existing,
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
    const { result } = renderHook(() => useSuiteMetrics('proj-1'), { wrapper: ({ children }) => withQueryClient(children) })
    const m1 = result.current.perSuite.find((m) => m.suite.id === 'suite-1')
    expect(m1!.suite.isDefault).toBe(true)
    expect(m1!.suite.description.length).toBeGreaterThan(0)
    expect(m1!.suite.tags.length).toBeGreaterThan(0)
  })
})

// Sanity: ensure createMockSuite is reachable from this test file
it('createMockSuite helper sanity', () => {
  const s = createMockSuite({ name: 'X' })
  expect(s.name).toBe('X')
  expect(s.description).toBeDefined()
  expect(s.tags).toEqual(['smoke', 'auth'])
})
