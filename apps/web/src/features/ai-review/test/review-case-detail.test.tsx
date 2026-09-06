import { screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ReviewCaseDetail } from '@/features/ai-review/components/review-case-detail'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { proposalListFixtures } from '@/test/review-api-stub'
import type { ProposalListItem } from '@/features/review-inbox/api/review.api'

function proposal(id: string): ProposalListItem {
  const found = proposalListFixtures().find((item) => item.id === id)
  if (!found) throw new Error(`Missing seeded proposal: ${id}`)
  return found
}

describe('ReviewCaseDetail', () => {
  beforeEach(() => __resetStore())

  it('renders the proposal title', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('review-proposal-checkout')} />)
    })
    expect(screen.getByRole('heading', { name: 'Checkout with empty cart blocked' })).toBeInTheDocument()
  })

  it('renders steps', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('review-proposal-checkout')} />)
    })
    expect(screen.getByText('Navigate to /checkout without any items in cart')).toBeInTheDocument()
    expect(screen.getByText('Observe the proceed button')).toBeInTheDocument()
  })

  it('renders expected result', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('review-proposal-checkout')} />)
    })
    expect(screen.getByText('Proceed button is disabled, "Your cart is empty" message is shown')).toBeInTheDocument()
  })

  it('renders the source snippet from linked evidence', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('review-proposal-checkout')} />)
    })
    const code = document.querySelector('code')
    expect(code?.textContent).toContain('should block')
  })

  it('shows the matching Phase 0 provenance and traceability contracts', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('review-proposal-checkout')} />)
    })
    expect(screen.getByRole('region', { name: 'Provenance' })).toHaveTextContent('mock://checkout.spec.ts')
    expect(screen.getByRole('region', { name: 'Traceability' })).toHaveTextContent('evidence-ai-2')
  })

  it('renders the duplicate comparison card when the proposal targets an existing test case', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('review-proposal-checkout')} />)
    })
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
    expect(screen.getAllByText('Checkout with empty cart blocked').length).toBeGreaterThan(1)
  })

  it('does not render the duplicate comparison card when the proposal has no target test case', async () => {
    await act(async () => {
      renderWithQuery(<ReviewCaseDetail proposal={proposal('proposal-ai-4')} />)
    })
    expect(screen.queryByText('Possible duplicate')).not.toBeInTheDocument()
  })
})
