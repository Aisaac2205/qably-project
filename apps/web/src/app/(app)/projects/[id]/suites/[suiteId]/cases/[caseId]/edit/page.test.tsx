import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EditCasePage from './page'
import { renderWithQuery } from '@/lib/query-test-utils'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'

vi.mock('@/features/projects/suites/hooks/use-suites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/projects/suites/hooks/use-suites')>()
  return { ...actual, useSuite: vi.fn(actual.useSuite) }
})

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

function paramsFor(id: string, suiteId: string, caseId: string) {
  return Promise.resolve({ id, suiteId, caseId })
}

describe('EditCasePage', () => {
  it('shows a distinct error state, not "case not found", when the suite fails to load', async () => {
    vi.mocked(useSuite).mockReturnValueOnce({ suite: undefined, isLoading: false, isError: true })
    await act(async () => {
      renderWithQuery(<EditCasePage params={paramsFor('proj-1', 'suite-1', 'case-1')} />)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Case not found')).not.toBeInTheDocument()
  })

  it('still shows "case not found" when the case genuinely does not exist', async () => {
    vi.mocked(useSuite).mockReturnValueOnce({ suite: undefined, isLoading: false, isError: false })
    await act(async () => {
      renderWithQuery(<EditCasePage params={paramsFor('proj-1', 'suite-1', 'missing-case')} />)
    })
    expect(screen.getByText('Case not found')).toBeInTheDocument()
  })
})
