import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { AiReviewPage } from '@/features/ai-review/components/ai-review-page'
import { __resetStore } from '@/lib/mock-store'

describe('AiReviewPage', () => {
  beforeEach(() => __resetStore())

  it('renders the Review Queue tab by default with pending cases', async () => {
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    expect(screen.getByRole('tab', { name: 'Review Queue' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Checkout with empty cart blocked').length).toBeGreaterThan(0)
  })

  it('shows a connected-provider badge in the header', async () => {
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    expect(screen.getByText('Claude connected')).toBeInTheDocument()
  })

  it('switches to the Project Chat tab', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    await user.click(screen.getByRole('tab', { name: 'Project Chat' }))
    expect(screen.getByText('What suites have the most pending AI cases?')).toBeInTheDocument()
  })

  it('confirms all pending cases via the toolbar bulk action', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AiReviewPage projectId="proj-1" />)
    })
    const pendingBefore = screen.getAllByRole('option').length
    expect(pendingBefore).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: `Confirm all ${pendingBefore} pending cases` }))
    expect(screen.getByText('No AI cases pending review')).toBeInTheDocument()
  })
})
