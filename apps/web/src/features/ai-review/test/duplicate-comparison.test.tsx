import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DuplicateComparison } from '@/features/ai-review/components/duplicate-comparison'
import * as duplicatesApi from '@/features/ai-review/api/duplicates.api'

vi.mock('@/features/ai-review/api/duplicates.api')

function renderComparison(proposalId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return render(
    <QueryClientProvider client={client}>
      <DuplicateComparison proposalId={proposalId} />
    </QueryClientProvider>,
  )
}

describe('DuplicateComparison', () => {
  afterEach(() => {
    vi.mocked(duplicatesApi.getDuplicateCandidates).mockReset()
  })

  it('shows the not-found message when the proposal has no plausible duplicates', async () => {
    vi.mocked(duplicatesApi.getDuplicateCandidates).mockResolvedValue([])

    renderComparison('proposal-1')

    expect(
      await screen.findByText(/could not be located/i),
    ).toBeInTheDocument()
  })

  it('renders each ranked candidate with its title, match reason, and expected result', async () => {
    vi.mocked(duplicatesApi.getDuplicateCandidates).mockResolvedValue([
      {
        id: 'case-1',
        title: 'Checkout with empty cart blocked',
        steps: ['Open checkout with an empty cart'],
        expectedResult: 'The checkout button is disabled',
        matchReason: 'automation-key',
      },
      {
        id: 'case-2',
        title: 'Checkout blocks empty carts',
        steps: ['Open checkout with an empty cart'],
        expectedResult: 'An error message is shown',
        matchReason: 'token-overlap',
      },
    ])

    renderComparison('proposal-1')

    expect(
      await screen.findByText('Checkout with empty cart blocked'),
    ).toBeInTheDocument()
    expect(screen.getByText('The checkout button is disabled')).toBeInTheDocument()
    expect(screen.getByText('Same automation key')).toBeInTheDocument()
    expect(screen.getByText('Checkout blocks empty carts')).toBeInTheDocument()
    expect(screen.getByText('Similar title')).toBeInTheDocument()
  })

  it('shows the not-found message when the duplicates query fails', async () => {
    vi.mocked(duplicatesApi.getDuplicateCandidates).mockRejectedValue(
      new Error('network error'),
    )

    renderComparison('proposal-1')

    expect(
      await screen.findByText(/could not be located/i),
    ).toBeInTheDocument()
  })
})
