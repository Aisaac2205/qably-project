import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectChatPanel } from '@/features/ai-review/components/project-chat-panel'
import { __resetStore, disconnectAiProvider } from '@/lib/mock-store'

describe('ProjectChatPanel', () => {
  beforeEach(() => __resetStore())

  it('shows an empty state with a settings link when no provider is connected', async () => {
    disconnectAiProvider('claude')
    await act(async () => {
      render(<ProjectChatPanel projectId="proj-1" onViewCase={vi.fn()} />)
    })
    expect(screen.getByText(/connect an ai provider/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to settings/i })).toHaveAttribute('href', '/settings')
  })

  it('shows the chat and sends a message when a provider is connected', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<ProjectChatPanel projectId="proj-1" onViewCase={vi.fn()} />)
    })
    expect(screen.getByText('What suites have the most pending AI cases?')).toBeInTheDocument()
    const textarea = screen.getByPlaceholderText('Ask about this project or request a new test case…')
    await user.type(textarea, 'How many cases are pending?{enter}')
    expect(await screen.findAllByText('How many cases are pending?')).not.toHaveLength(0)
  })
})
