import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatGeneratedCaseCard } from '@/features/ai-review/components/chat-generated-case-card'
import { __resetStore } from '@/lib/mock-store'

describe('ChatGeneratedCaseCard', () => {
  beforeEach(() => __resetStore())

  it('shows the case name and a link to view it', async () => {
    const onView = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ChatGeneratedCaseCard caseId="ai-1" projectId="proj-1" onView={onView} />)
    })
    expect(screen.getByText('Valid checkout completes order')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View in Review Queue' }))
    expect(onView).toHaveBeenCalledWith('ai-1')
  })

  it('renders nothing if the case cannot be found', async () => {
    const { container } = render(<ChatGeneratedCaseCard caseId="missing" projectId="proj-1" onView={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
