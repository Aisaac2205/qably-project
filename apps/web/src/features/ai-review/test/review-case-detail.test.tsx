import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ReviewCaseDetail } from '@/features/ai-review/components/review-case-detail'
import { __resetStore, getProposal } from '@/lib/mock-store'

describe('ReviewCaseDetail', () => {
  beforeEach(() => __resetStore())

  it('renders the proposal title', async () => {
    const proposal = getProposal('review-proposal-checkout')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    expect(screen.getByRole('heading', { name: 'Checkout with empty cart blocked' })).toBeInTheDocument()
  })

  it('renders steps', async () => {
    const proposal = getProposal('review-proposal-checkout')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    expect(screen.getByText('Navigate to /checkout without any items in cart')).toBeInTheDocument()
    expect(screen.getByText('Observe the proceed button')).toBeInTheDocument()
  })

  it('renders expected result', async () => {
    const proposal = getProposal('review-proposal-checkout')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    expect(screen.getByText('Proceed button is disabled, "Your cart is empty" message is shown')).toBeInTheDocument()
  })

  it('renders the source snippet from linked evidence', async () => {
    const proposal = getProposal('review-proposal-checkout')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    const code = document.querySelector('code')
    expect(code?.textContent).toContain('should block')
  })

  it('shows the matching Phase 0 provenance and traceability contracts', async () => {
    const proposal = getProposal('review-proposal-checkout')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    expect(screen.getByRole('region', { name: 'Provenance' })).toHaveTextContent('mock://checkout.spec.ts')
    expect(screen.getByRole('region', { name: 'Traceability' })).toHaveTextContent('evidence-ai-2')
  })

  it('renders the duplicate comparison card when the proposal targets an existing test case', async () => {
    const proposal = getProposal('review-proposal-checkout')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
    expect(screen.getAllByText('Checkout with empty cart blocked').length).toBeGreaterThan(1)
  })

  it('does not render the duplicate comparison card when the proposal has no target test case', async () => {
    const proposal = getProposal('proposal-ai-4')!
    await act(async () => {
      render(<ReviewCaseDetail proposal={proposal} />)
    })
    expect(screen.queryByText('Possible duplicate')).not.toBeInTheDocument()
  })
})
