import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProposalListItem } from '../api/review.api'
import { ReviewQueueRow } from '../components/review-queue-row'

function proposal(overrides: Partial<ProposalListItem> = {}): ProposalListItem {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: [],
    steps: ['Open the cart', 'Remove every item'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    evidenceId: 'evidence-1',
    evidenceTitle: 'src/cart.spec.ts',
    needsManualReview: false,
    ...overrides,
  }
}

describe('ReviewQueueRow', () => {
  it('renders a source-unavailable http-404 reason as plain language, never the raw code', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          needsManualReview: true,
          steps: [],
          objective: 'http-404',
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByText('http-404')).not.toBeInTheDocument()
    expect(
      screen.getByText(/could not be found at that commit|no se pudo encontrar/i),
    ).toBeInTheDocument()
  })
})
