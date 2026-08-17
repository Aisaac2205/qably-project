import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectChatPanel } from '@/features/ai-review/components/project-chat-panel'
import { __resetStore, disconnectAiProvider } from '@/lib/mock-store'

describe('ProjectChatPanel', () => {
  beforeEach(() => __resetStore())

  it('blocks chat with an available return-to-review action when no provider is connected', async () => {
    const onReturnToReview = vi.fn()
    const user = userEvent.setup()
    disconnectAiProvider('gemini')
    await act(async () => {
      render(<ProjectChatPanel projectId="proj-1" onViewCase={vi.fn()} onReturnToReview={onReturnToReview} />)
    })
    const blockedState = screen.getByText('AI chat is unavailable').parentElement?.parentElement
    expect(blockedState).toHaveAttribute('data-state-kind', 'blocked')
    expect(screen.getByText('No AI provider is connected. You can continue reviewing the existing queue.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Return to Review Queue' }))
    expect(onReturnToReview).toHaveBeenCalledOnce()
  })

  it('shows the chat and sends a message when a provider is connected', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<ProjectChatPanel projectId="proj-1" onViewCase={vi.fn()} onReturnToReview={vi.fn()} />)
    })
    expect(screen.getByText('What suites have the most pending AI cases?')).toBeInTheDocument()
    const textarea = screen.getByRole('textbox', { name: 'AI prompt' })
    await user.type(textarea, 'How many cases are pending?{enter}')
    expect(await screen.findAllByText('How many cases are pending?')).not.toHaveLength(0)
  })
})
