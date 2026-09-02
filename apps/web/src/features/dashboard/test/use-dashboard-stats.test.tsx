import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { withQueryClient } from '@/lib/query-test-utils'
import { __resetStore, getSnapshot } from '@/lib/mock-store'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { projectKeys } from '@/features/projects/lib/query-keys'
import { projectFixtures } from '@/test/projects-api-stub'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

describe('useDashboardStats — pure derivation', () => {
  it('has the right structure documentation', () => {
    const expectedKeys = [
      'totalProjects',
      'totalSuites',
      'totalRuns',
      'pendingProposals',
      'passRateLast7d',
      'passRateTrend',
      'activeRuns',
      'projectsByHealth',
      'recentRuns',
      'recentProposals',
      'recentCiRuns',
    ]
    expect(expectedKeys.length).toBe(11)
  })

  it('mock store has expected seed counts for the parts still mocked', () => {
    __resetStore()
    const snap = getSnapshot()
    expect(snap.proposals.length).toBe(6)
  })

  it('derives run stats from the api-backed runs list, not the mock store', () => {
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    // Seeded fixture (runs-api-stub) has 4 org-wide runs.
    expect(result.current.totalRuns).toBe(4)
    expect(result.current.recentRuns.length).toBeGreaterThan(0)
    expect(result.current.recentCiRuns.every((r) => r.source === 'github_actions')).toBe(true)
  })

  it('derives project totals from the api-backed projects list, not the mock store', () => {
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    // Seeded fixture (projects-api-stub) has 4 organization projects.
    expect(result.current.totalProjects).toBe(4)
    expect(result.current.totalSuites).toBe(3)
    expect(result.current.projectsByHealth).toHaveLength(4)
    expect(result.current.projectsByHealth.map((entry) => entry.project.name)).toContain('Ecommerce App')
    // activity is explicitly null (an honest gap), never fabricated data.
    expect(result.current.projectsByHealth[0].project.activity).toBeNull()
  })

  it('reads its windowed metrics straight from the dashboard summary endpoint, never from a client-side clock', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    client.setQueryData(projectKeys.all, projectFixtures)
    client.setQueryData(dashboardKeys.summary('all'), {
      totalProjects: 7,
      totalSuites: 9,
      totalRuns: 42,
      runsInWindow: 11,
      activeRuns: 2,
      passRate: 0.6,
      passRateTrend: -0.1,
      defectsDetected: 5,
      windowDays: 7,
      recentRuns: [],
      recentCiRuns: [],
    })

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    expect(result.current.totalProjects).toBe(7)
    expect(result.current.totalSuites).toBe(9)
    expect(result.current.totalRuns).toBe(42)
    expect(result.current.runsLast7d).toBe(11)
    expect(result.current.activeRuns).toBe(2)
    expect(result.current.passRateLast7d).toBe(60)
    expect(result.current.passRateTrend).toBe(-10)
  })
})
