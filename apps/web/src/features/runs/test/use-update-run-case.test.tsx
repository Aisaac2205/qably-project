import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useUpdateRunCase } from '@/features/runs/hooks/use-update-run-case'
import { useRun } from '@/features/runs/hooks/use-runs'
import { createTestQueryClient } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

function setup() {
  const client = createTestQueryClient()
  const { result } = renderHook(
    () => ({
      update: useUpdateRunCase('run-12'),
      // An active useRun observer is what keeps the cache entry alive and
      // is how a real caller (RunDetailPageClient) sees the patched run.
      run: useRun('run-12').run,
    }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  )
  return result
}

describe('useUpdateRunCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('patches a case status and updates the cache the run detail view reads from', async () => {
    const result = setup()

    act(() => {
      result.current.update('tc-1', 'fail')
    })

    await waitFor(() => {
      expect(result.current.run?.cases.find((c) => c.id === 'tc-1')?.status).toBe('fail')
    })
  })

  it('updates status for multiple cases sequentially', async () => {
    const result = setup()

    act(() => {
      result.current.update('tc-1', 'skip')
    })
    await waitFor(() => {
      expect(result.current.run?.cases.find((c) => c.id === 'tc-1')?.status).toBe('skip')
    })

    act(() => {
      result.current.update('tc-2', 'pass')
    })
    await waitFor(() => {
      expect(result.current.run?.cases.find((c) => c.id === 'tc-2')?.status).toBe('pass')
    })
  })
})
