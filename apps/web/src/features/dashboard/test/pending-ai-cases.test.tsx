import { render, screen, act, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { PendingProposals } from '@/features/dashboard/components/pending-ai-cases'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import { proposalListFixtures } from '@/test/review-api-stub'
import { listProposals } from '@/features/review-inbox/api/review.api'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/review-inbox/api/review.api', () => ({
  listProposals: vi.fn(),
}))

const listProposalsMock = vi.mocked(listProposals)

describe('PendingProposals', () => {
  beforeEach(() => {
    __resetStore()
    listProposalsMock.mockResolvedValue(proposalListFixtures())
  })

  it('renders pending proposals heading with count badge', async () => {
    await act(async () => {
      renderWithQuery(<PendingProposals />)
    })
    expect(screen.getByRole('heading', { name: /pending proposals/i })).toBeInTheDocument()
    expect(screen.getByText(/pending/)).toBeInTheDocument()
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
  })

  it('shows pending proposals with titles and review CTA', async () => {
    await act(async () => {
      renderWithQuery(<PendingProposals />)
    })
    // Proposals are sorted by title; the first seed proposals include this one
    expect(screen.getByText('Invalid login shows error message')).toBeInTheDocument()
    const reviewButtons = screen.getAllByText('Review')
    expect(reviewButtons.length).toBeGreaterThan(0)
  })

  it('links each proposal review action to that exact proposal instead of a generic inbox', async () => {
    await act(async () => {
      renderWithQuery(<PendingProposals />)
    })

    const inReview = proposalListFixtures()
      .filter((proposal) => proposal.status === 'in_review')
      .sort((a, b) => a.title.localeCompare(b.title))
    const [firstProposal] = inReview

    const row = screen.getByText(firstProposal.title).closest('.group') as HTMLElement
    const link = within(row).getByRole('link', { name: /review/i })
    expect(link).toHaveAttribute('href', `/review-inbox?proposal=${firstProposal.id}`)
  })

  it('declares its own container context instead of depending on the page section width', async () => {
    await act(async () => {
      renderWithQuery(<PendingProposals />)
    })

    const region = screen.getByRole('region', { name: /pending proposals/i })
    expect(region).toHaveClass('@container')
    expect(region.className).not.toContain('shadow-xs')
  })

  it('shows skeleton content while proposals load, never stale rows', async () => {
    listProposalsMock.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: reviewKeys.list() })

    const { container } = render(
      <QueryClientProvider client={client}>
        <PendingProposals />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: /pending proposals/i })).toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows one error state with a retry action wired to the proposals query when it fails', async () => {
    listProposalsMock.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: reviewKeys.list() })

    render(
      <QueryClientProvider client={client}>
        <PendingProposals />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()

    listProposalsMock.mockResolvedValueOnce(proposalListFixtures())
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getAllByText('Review').length).toBeGreaterThan(0))
  })
})
