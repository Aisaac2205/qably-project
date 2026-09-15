import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProposals } from './use-proposals'
import { listProposals, type ProposalListItem } from '../api/review.api'

vi.mock('../api/review.api', () => ({ listProposals: vi.fn() }))

const list = vi.mocked(listProposals)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return createElement(QueryClientProvider, { client }, children)
}

const proposal: ProposalListItem = {
  id: 'prop-1',
  projectId: 'p1',
  status: 'in_review',
  title: 'Checkout flow',
  objective: 'Verify the checkout flow completes successfully',
  preconditions: [],
  steps: [],
  expectedResult: 'Order is confirmed',
  priority: 'medium',
  evidenceId: 'ev-1',
  evidenceTitle: 'Checkout evidence',
  needsManualReview: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([proposal])
})

describe('useProposals', () => {
  it('exposes a refetch function to re-trigger the query', async () => {
    const { result } = renderHook(() => useProposals(), { wrapper })

    await waitFor(() => expect(result.current.proposals).toEqual([proposal]))

    expect(typeof result.current.refetch).toBe('function')

    const proposal2: ProposalListItem = { ...proposal, id: 'prop-2', title: 'Billing flow' }
    list.mockResolvedValue([proposal, proposal2])
    await result.current.refetch()

    await waitFor(() => expect(result.current.proposals).toHaveLength(2))
  })
})
