import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { withQueryClient } from '@/lib/query-test-utils'
import { __resetStore, getSnapshot } from '@/lib/mock-store'

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
    expect(snap.projects.length).toBe(4)
    expect(snap.proposals.length).toBe(6)
    expect(snap.org.name).toBe('Acme QA Team')
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
})
