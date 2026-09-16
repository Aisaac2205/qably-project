import { act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EditCasePage from './page'
import { renderWithQuery } from '@/lib/query-test-utils'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

function paramsFor(id: string, suiteId: string, caseId: string) {
  return Promise.resolve({ id, suiteId, caseId })
}

describe('EditCasePage', () => {
  it('redirects to the suite edit page with this case preselected', async () => {
    await act(async () => {
      renderWithQuery(<EditCasePage params={paramsFor('proj-1', 'suite-1', 'case-1')} />)
    })
    expect(mockReplace).toHaveBeenCalledWith('/projects/proj-1/suites/suite-1/edit?case=case-1')
  })
})
