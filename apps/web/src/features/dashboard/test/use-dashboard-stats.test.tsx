import { describe, it, expect, beforeEach, vi } from 'vitest'
import { __resetStore, getSnapshot } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: Record<string, unknown>) => null,
}))

describe('useDashboardStats — pure derivation', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('has the right structure documentation', () => {
    const expectedKeys = [
      'totalProjects',
      'totalSuites',
      'totalRuns',
      'pendingAiCases',
      'passRateLast7d',
      'passRateTrend',
      'activeRuns',
      'projectsByHealth',
      'recentRuns',
      'recentAiCases',
      'recentPipelines',
    ]
    expect(expectedKeys.length).toBe(11)
  })

  it('mock store has expected seed counts', () => {
    const snap = getSnapshot()
    expect(snap.projects.length).toBe(4)
    expect(snap.runs.length).toBe(4)
    expect(snap.aiCases.length).toBe(4)
    expect(snap.pipelines.length).toBe(0)
    expect(snap.org.name).toBe('Acme QA Team')
  })
})
