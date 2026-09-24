import type { ComponentProps } from 'react'
import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewInboxQueue } from '../components/review-inbox-queue'
import type { ProposalListItem } from '../api/review.api'
import { renderWithQuery, withQueryClient } from '@/lib/query-test-utils'

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

function renderQueue(
  proposals: ProposalListItem[],
  overrides: Partial<ComponentProps<typeof ReviewInboxQueue>> = {},
) {
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
      {...overrides}
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

  it('renders no load-more control when there is no next page', async () => {
    await act(async () => {
      renderQueue([proposal()])
    })

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('shows a load-more button when a next page is available and calls onLoadMore', async () => {
    const onLoadMore = vi.fn()
    const user = userEvent.setup()

    await act(async () => {
      renderQueue([proposal()], { hasNextPage: true, onLoadMore })
    })

    const button = screen.getByRole('button', { name: /load more/i })
    await user.click(button)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables the load-more button while the next page is fetching', async () => {
    await act(async () => {
      renderQueue([proposal()], {
        hasNextPage: true,
        isFetchingNextPage: true,
        onLoadMore: vi.fn(),
      })
    })

    expect(screen.getByRole('button', { name: /loading more/i })).toBeDisabled()
  })

  it('announces the loaded item count in a polite live region once more proposals load', async () => {
    const initial = [proposal({ id: 'proposal-1' })]
    let result: ReturnType<typeof renderQueue>

    await act(async () => {
      result = renderQueue(initial, { hasNextPage: true, onLoadMore: vi.fn() })
    })

    const grown = [
      proposal({ id: 'proposal-1' }),
      proposal({ id: 'proposal-2', title: 'Second proposal' }),
      proposal({ id: 'proposal-3', title: 'Third proposal' }),
    ]

    await act(async () => {
      result.rerender(
        withQueryClient(
          <ReviewInboxQueue
            proposals={grown}
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
            hasNextPage={true}
            onLoadMore={vi.fn()}
          />,
        ),
      )
    })

    expect(screen.getByRole('status')).toHaveTextContent('2 more proposals loaded')
  })

  it('moves focus to the first newly loaded row once the last page loads and load-more unmounts', async () => {
    const initial = [proposal({ id: 'proposal-1' }), proposal({ id: 'proposal-2' })]
    let result: ReturnType<typeof renderQueue>

    await act(async () => {
      result = renderQueue(initial, { hasNextPage: true, onLoadMore: vi.fn() })
    })

    screen.getByRole('button', { name: /load more/i }).focus()

    const grown = [
      proposal({ id: 'proposal-1' }),
      proposal({ id: 'proposal-2' }),
      proposal({ id: 'proposal-3', title: 'Newly loaded proposal' }),
    ]

    await act(async () => {
      result.rerender(
        withQueryClient(
          <ReviewInboxQueue
            proposals={grown}
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
            hasNextPage={false}
            onLoadMore={vi.fn()}
          />,
        ),
      )
    })

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    expect(document.activeElement).toHaveAccessibleName(/Newly loaded proposal/)
  })
})
