import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewCaseList } from '@/features/ai-review/components/review-case-list'
import { __resetStore, getProposal } from '@/lib/mock-store'
import type { ExtractedProposal } from '@qably/types'

function proposal(id: string): ExtractedProposal {
  const found = getProposal(id)
  if (!found) throw new Error(`Missing seeded proposal: ${id}`)
  return found
}

describe('ReviewCaseList', () => {
  beforeEach(() => __resetStore())

  it('renders all proposals', async () => {
    const onSelect = vi.fn()
    const proposals = [proposal('review-proposal-checkout'), proposal('proposal-ai-3'), proposal('proposal-ai-4')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} onSelect={onSelect} />)
    })
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
    expect(screen.getByText('Discount code reduces total')).toBeInTheDocument()
    expect(screen.getByText('Invalid login shows error message')).toBeInTheDocument()
  })

  it('renders source file names from linked evidence', async () => {
    const onSelect = vi.fn()
    const proposals = [proposal('review-proposal-checkout'), proposal('proposal-ai-3'), proposal('proposal-ai-4')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} onSelect={onSelect} />)
    })
    expect(screen.getAllByText('checkout.spec.ts').length).toBe(2)
  })

  it('calls onSelect with the proposal id on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    const proposals = [proposal('review-proposal-checkout'), proposal('proposal-ai-4')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} onSelect={onSelect} />)
    })
    await user.click(screen.getByRole('button', { name: /Invalid login shows error message/i }))
    expect(onSelect).toHaveBeenCalledWith('proposal-ai-4')
  })

  it('highlights the selected proposal', async () => {
    const onSelect = vi.fn()
    const proposals = [proposal('review-proposal-checkout'), proposal('proposal-ai-3')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} selectedId="proposal-ai-3" onSelect={onSelect} />)
    })
    const selected = screen.getByRole('button', { name: /Discount code reduces total/i })
    expect(screen.getByRole('list', { name: 'AI review cases' })).toBeInTheDocument()
    expect(selected).toHaveAttribute('aria-current', 'true')
    expect(selected.className).toContain('bg-surface-hover')
  })

  it('shows empty state', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<ReviewCaseList proposals={[]} onSelect={onSelect} />)
    })
    expect(screen.getByText('No AI cases pending review')).toBeInTheDocument()
  })

  it('shows a duplicate badge when the proposal targets an existing test case', async () => {
    const onSelect = vi.fn()
    const proposals = [proposal('review-proposal-checkout')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} onSelect={onSelect} />)
    })
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
  })

  it('filters to only proposals that target an existing test case', async () => {
    const onSelect = vi.fn()
    const proposals = [proposal('review-proposal-checkout'), proposal('proposal-ai-4')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} onSelect={onSelect} filter="duplicates" />)
    })
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
    expect(screen.queryByText('Invalid login shows error message')).not.toBeInTheDocument()
  })

  it('shows the chat origin icon for proposals sourced from chat evidence', async () => {
    const onSelect = vi.fn()
    const proposals = [proposal('proposal-ai-5')]
    await act(async () => {
      render(<ReviewCaseList proposals={proposals} onSelect={onSelect} />)
    })
    expect(screen.getByLabelText('Generated from chat')).toBeInTheDocument()
  })
})
