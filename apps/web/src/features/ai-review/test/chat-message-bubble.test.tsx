import { screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatMessageBubble } from '@/features/ai-review/components/chat-message-bubble'
import type { ChatMessageRecord } from '@qably/types'
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
})
