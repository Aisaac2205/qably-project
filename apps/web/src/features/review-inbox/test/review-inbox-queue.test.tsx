import { screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewInboxQueue } from '../components/review-inbox-queue'
import type { ProposalListItem } from '../api/review.api'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/api/projects.api', async () =>
  await import('@/test/projects-api-stub'),
)

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

function renderQueue(proposals: ProposalListItem[]) {
  return renderWithQuery(
    <ReviewInboxQueue
      proposals={proposals}
      selectedId={undefined}
      onSelect={vi.fn()}
      selectedProjectId="all"
      onSelectProject={vi.fn()}
      statusFilter="all"
      onStatusFilterChange={vi.fn()}
      duplicateOnly={false}
      onToggleDuplicateOnly={vi.fn()}
      searchQuery=""
      onSearchQueryChange={vi.fn()}
    />,
  )
}

describe('ReviewInboxQueue', () => {
  it('shows a translated reason instead of the raw provider code for a manual-review proposal', async () => {
    await act(async () => {
      renderQueue([
        proposal({
          needsManualReview: true,
          steps: [],
          objective: 'rate-limited',
        }),
      ])
    })

    expect(screen.queryByText('rate-limited')).not.toBeInTheDocument()
    expect(
      screen.getByText(/rate-limiting requests|reintentos automáticos/i),
    ).toBeInTheDocument()
  })

  it('shows the real objective for a proposal that does not need manual review', async () => {
    await act(async () => {
      renderQueue([proposal({ objective: 'Confirm the cart resets' })])
    })

    expect(screen.getByText('Confirm the cart resets')).toBeInTheDocument()
  })
})
