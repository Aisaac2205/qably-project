import { act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewCasePage from './page'
import { renderWithQuery } from '@/lib/query-test-utils'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

function paramsFor(id: string, suiteId: string) {
  return Promise.resolve({ id, suiteId })
}

describe('NewCasePage', () => {
  it('redirects to the suite edit page with a new case draft preselected', async () => {
    await act(async () => {
      renderWithQuery(<NewCasePage params={paramsFor('proj-1', 'suite-1')} />)
    })
    expect(mockReplace).toHaveBeenCalledWith('/projects/proj-1/suites/suite-1/edit?case=new')
  })
})
