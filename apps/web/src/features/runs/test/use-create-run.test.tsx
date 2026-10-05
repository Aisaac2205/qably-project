import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useCreateRun } from '@/features/runs/hooks/use-create-run'
import { createTestQueryClient } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}))

function setup(options?: { replaceOnCreate?: boolean }) {
  const client = createTestQueryClient()
  return renderHook(() => useCreateRun('proj-1', options), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

describe('useCreateRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the run detail with a push by default, so back returns to the page it started from', async () => {
    const { result } = setup()

    result.current.start('suite-1')

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/^\/projects\/proj-1\/runs\/\S+$/))
    })
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it('replaces the current entry with the run detail when asked, so the form route leaves history', async () => {
    const { result } = setup({ replaceOnCreate: true })

    result.current.start('suite-1')

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/projects\/proj-1\/runs\/\S+$/))
    })
    expect(navigation.push).not.toHaveBeenCalled()
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
