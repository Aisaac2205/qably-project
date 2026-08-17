import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { AiReviewPage } from '@/features/ai-review/components/ai-review-page'
import { __resetStore, approveProposal, disconnectAiProvider, getMembers, getSnapshot } from '@/lib/mock-store'

function confirmPendingCases(projectId: string) {
  const actor = getMembers()[0]
  for (const proposal of getSnapshot().proposals) {
    if (proposal.projectId === projectId && proposal.status === 'in_review') {
      approveProposal(proposal.id, { actorId: actor.id })
    }
  }
}

describe('AiReviewPage', () => {
  beforeEach(() => __resetStore())

  it('renders the Review Queue tab by default with pending cases', async () => {
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    expect(screen.getByRole('tab', { name: 'Review Queue' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Checkout with empty cart blocked').length).toBeGreaterThan(0)
  })

  it('switches to the Project Chat tab', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    await user.click(screen.getByRole('tab', { name: 'Project Chat' }))
    expect(screen.getByText('What suites have the most pending AI cases?')).toBeInTheDocument()
  })

  it('does not focus an initially empty review queue', async () => {
    confirmPendingCases('proj-1')
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })

    expect(screen.getByText('No AI cases pending review').parentElement?.parentElement).not.toHaveFocus()
  })

  it('does not steal focus when an empty review queue rerenders', async () => {
    confirmPendingCases('proj-1')
    const { rerender } = render(<><button type="button">Keep focus</button><AiReviewPage projectId="proj-1" /></>)
    const trigger = screen.getByRole('button', { name: 'Keep focus' })
    trigger.focus()

    rerender(<><button type="button">Keep focus</button><AiReviewPage projectId="proj-1" /></>)

    expect(trigger).toHaveFocus()
  })

  it('does not expose the prohibited mass-confirm action', async () => {
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    expect(within(screen.getByRole('list', { name: 'AI review cases' })).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /confirm all/i })).not.toBeInTheDocument()
  })

  it('activates review filters by keyboard and exposes their pressed state', async () => {
    const user = userEvent.setup()
    render(<AiReviewPage projectId="proj-1" />)
    const all = screen.getByRole('button', { name: 'All' })
    const duplicates = screen.getByRole('button', { name: 'Possible duplicates' })

    expect(all).toHaveAttribute('aria-pressed', 'true')
    duplicates.focus()
    await user.keyboard('{Enter}')

    expect(duplicates).toHaveFocus()
    expect(duplicates).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps case selection and review actions keyboard reachable in a 320px flow', async () => {
    const user = userEvent.setup()
    render(<div style={{ width: 320 }}><AiReviewPage projectId="proj-1" /></div>)
    const all = screen.getByRole('button', { name: 'All' })
    const confirm = screen.getByRole('button', { name: 'Confirm case' })

    all.focus()
    for (let step = 0; step < 12 && document.activeElement !== confirm; step += 1) {
      await user.tab()
    }

    expect(confirm).toHaveFocus()
    expect(screen.getAllByText('Checkout with empty cart blocked').length).toBeGreaterThan(0)
  })

  it('returns blocked chat to the active Review Queue tab', async () => {
    const user = userEvent.setup()
    disconnectAiProvider('gemini')
    render(<AiReviewPage projectId="proj-1" />)

    await user.click(screen.getByRole('tab', { name: 'Project Chat' }))
    expect(screen.getByText('AI chat is unavailable')).toBeInTheDocument()
    expect(screen.getByText('No AI provider is connected. You can continue reviewing the existing queue.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Return to Review Queue' }))

    expect(screen.getByRole('tab', { name: 'Review Queue' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('list', { name: 'AI review cases' })).toBeInTheDocument()
  })
})
