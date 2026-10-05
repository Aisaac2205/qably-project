import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import EditSuitePage from './page'
import { renderWithQuery } from '@/lib/query-test-utils'
import { createMockSuite } from '@/lib/test-utils'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/features/projects/suites/hooks/use-suites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/projects/suites/hooks/use-suites')>()
  return { ...actual, useSuite: vi.fn(actual.useSuite) }
})

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

function paramsFor(id: string, suiteId: string) {
  return Promise.resolve({ id, suiteId })
}

describe('EditSuitePage', () => {
  afterEach(() => {
    vi.mocked(useSuite).mockReset()
  })

  it('keeps the form on screen when a background refetch fails while the suite is loaded', async () => {
    vi.mocked(useSuite).mockReturnValue({
      suite: createMockSuite({ id: 'suite-1', projectId: 'proj-1', name: 'Checkout flow' }),
      isLoading: false,
      isError: true,
      dataUpdatedAt: 1,
    })
    await act(async () => {
      renderWithQuery(<EditSuitePage params={paramsFor('proj-1', 'suite-1')} />)
    })
    expect(screen.getByDisplayValue('Checkout flow')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a distinct error state, not "suite not found", when the suite fails to load', async () => {
    vi.mocked(useSuite).mockReturnValueOnce({
      suite: undefined,
      isLoading: false,
      isError: true,
      dataUpdatedAt: 0,
    })
    await act(async () => {
      renderWithQuery(<EditSuitePage params={paramsFor('proj-1', 'suite-1')} />)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Suite not found')).not.toBeInTheDocument()
  })

  it('still shows "suite not found" when the suite genuinely does not exist', async () => {
    vi.mocked(useSuite).mockReturnValueOnce({
      suite: undefined,
      isLoading: false,
      isError: false,
      dataUpdatedAt: 0,
    })
    await act(async () => {
      renderWithQuery(<EditSuitePage params={paramsFor('proj-1', 'missing-suite')} />)
    })
    expect(screen.getByText('Suite not found')).toBeInTheDocument()
  })
})
