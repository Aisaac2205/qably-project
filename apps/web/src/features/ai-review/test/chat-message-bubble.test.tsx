import { screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatMessageBubble } from '@/features/ai-review/components/chat-message-bubble'
import { ASSISTANT_MODEL_NAME, type ChatMessageRecord } from '@qably/types'
import { renderWithQuery } from '@/lib/query-test-utils'

describe('ChatMessageBubble', () => {
  it('renders user message content', async () => {
    const message: ChatMessageRecord = {
      id: 'm1',
      threadId: 't1',
      role: 'user',
      content: 'Hello there',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders a generated case card for each suggested case', async () => {
    const message: ChatMessageRecord = {
      id: 'm2',
      threadId: 't1',
      role: 'assistant',
      content: 'Drafted a case',
      suggestedCases: [
        {
          title: 'Valid checkout completes order',
          objective: 'Verify checkout',
          preconditions: [],
          steps: ['Add item', 'Checkout'],
          expectedResult: 'Order is placed',
          priority: 'medium',
        },
      ],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.getByText('Valid checkout completes order')).toBeInTheDocument()
  })

  it('resolves the target case name for a targeted suggestion from the passed-in attached cases', async () => {
    const message: ChatMessageRecord = {
      id: 'm6',
      threadId: 't1',
      role: 'assistant',
      content: 'Here is an updated version',
      suggestedCases: [
        {
          title: 'Valid login redirects to dashboard',
          objective: 'Verify login',
          preconditions: [],
          steps: ['Log in'],
          expectedResult: 'Dashboard is shown',
          priority: 'high',
          targetTestCaseId: 'tc-1',
        },
      ],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(
        <ChatMessageBubble
          projectId="proj-1"
          message={message}
          attachedCasesForProposals={[
            { id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' },
          ]}
        />,
      )
    })
    expect(screen.getByText('Updates: Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('names the model that produced an assistant reply', async () => {
    const message: ChatMessageRecord = {
      id: 'm3',
      threadId: 't1',
      role: 'assistant',
      content: 'Here is what I found',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.getByText(ASSISTANT_MODEL_NAME)).toBeInTheDocument()
  })

  it('shows the chips for cases attached to a user message', async () => {
    const message: ChatMessageRecord = {
      id: 'm5',
      threadId: 't1',
      role: 'user',
      content: 'Improve this case',
      suggestedCases: [],
      attachedCases: [{ id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' }],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('shows a grounding-insufficient indicator for an explicit decline', async () => {
    const message: ChatMessageRecord = {
      id: 'm7',
      threadId: 't1',
      role: 'assistant',
      content: 'I do not have verifiable information in this chat to answer that with confidence.',
      suggestedCases: [],
      grounding: { status: 'insufficient' },
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.getByText(/without citing specific data/i)).toBeInTheDocument()
  })

  it('does not show the grounding indicator for a legacy message with no grounding data', async () => {
    const message: ChatMessageRecord = {
      id: 'm8',
      threadId: 't1',
      role: 'assistant',
      content: 'Here is what I found',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.queryByText(/without citing specific data/i)).not.toBeInTheDocument()
  })

  it('does not show the grounding indicator for a grounded reply', async () => {
    const message: ChatMessageRecord = {
      id: 'm9',
      threadId: 't1',
      role: 'assistant',
      content: 'Here is what I found',
      suggestedCases: [],
      grounding: { status: 'grounded', references: [] },
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.queryByText(/without citing specific data/i)).not.toBeInTheDocument()
  })

  it('leaves a user message unattributed', async () => {
    const message: ChatMessageRecord = {
      id: 'm4',
      threadId: 't1',
      role: 'user',
      content: 'What is covered?',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      renderWithQuery(<ChatMessageBubble projectId="proj-1" message={message} />)
    })
    expect(screen.queryByText(ASSISTANT_MODEL_NAME)).not.toBeInTheDocument()
  })
})
