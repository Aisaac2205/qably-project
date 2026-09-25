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

  it('shows an update badge, never "possible duplicate", when the persisted classification is update', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: {
            kind: 'update',
            matchedCaseId: 'case-1',
            score: 1,
            reasons: ['same-automation-key'],
          },
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Updates an existing case in this suite')).toBeInTheDocument()
    expect(screen.queryByText('Possible duplicate')).not.toBeInTheDocument()
  })

  it('shows a possible-duplicate badge scoped to the suite when the persisted classification says so', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: {
            kind: 'possible_duplicate',
            matchedCaseId: 'case-2',
            score: 0.72,
            reasons: ['same-title'],
          },
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Possible duplicate of an existing case in this suite'),
    ).toBeInTheDocument()
  })

  it('shows neither badge when the classification is absent or none', () => {
    render(
      <ReviewQueueRow proposal={proposal()} isSelected={false} onSelect={vi.fn()} />,
    )

    expect(
      screen.queryByText('Updates an existing case in this suite'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Possible duplicate of an existing case in this suite'),
    ).not.toBeInTheDocument()
  })
})
