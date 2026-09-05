import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useCreateRun } from '@/features/runs/hooks/use-create-run'
import { createTestQueryClient } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function setup() {
  const client = createTestQueryClient()
  return renderHook(() => useCreateRun('proj-1'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

describe('useCreateRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the same start callback across a re-render with no state change', () => {
    const { result, rerender } = setup()
    const firstStart = result.current.start

    rerender()

    expect(result.current.start).toBe(firstStart)
  })

  it('keeps the same returned object across a re-render with no state change', () => {
    const { result, rerender } = setup()
    const firstReturn = result.current

    rerender()

    expect(result.current).toBe(firstReturn)
  })
})
