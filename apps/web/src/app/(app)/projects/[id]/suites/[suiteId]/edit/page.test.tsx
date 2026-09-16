import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EditSuitePage from './page'
import { renderWithQuery } from '@/lib/query-test-utils'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'

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
  it('shows a distinct error state, not "suite not found", when the suite fails to load', async () => {
    vi.mocked(useSuite).mockReturnValueOnce({ suite: undefined, isLoading: false, isError: true })
    await act(async () => {
      renderWithQuery(<EditSuitePage params={paramsFor('proj-1', 'suite-1')} />)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Suite not found')).not.toBeInTheDocument()
  })

  it('still shows "suite not found" when the suite genuinely does not exist', async () => {
    vi.mocked(useSuite).mockReturnValueOnce({ suite: undefined, isLoading: false, isError: false })
    await act(async () => {
      renderWithQuery(<EditSuitePage params={paramsFor('proj-1', 'missing-suite')} />)
    })
    expect(screen.getByText('Suite not found')).toBeInTheDocument()
  })
})
