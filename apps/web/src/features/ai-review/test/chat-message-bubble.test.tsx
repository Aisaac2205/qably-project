import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatMessageBubble } from '@/features/ai-review/components/chat-message-bubble'
import { __resetStore } from '@/lib/mock-store'
import type { ChatMessage } from '@qably/types'

describe('ChatMessageBubble', () => {
  beforeEach(() => __resetStore())

  it('renders user message content', async () => {
    const message: ChatMessage = {
      id: 'm1', threadId: 't1', role: 'user', content: 'Hello there', createdAt: '2026-01-01T00:00:00Z',
    }
    await act(async () => {
      render(<ChatMessageBubble message={message} projectId="proj-1" onViewCase={vi.fn()} />)
    })
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders a generated case card when generatedCaseIds is present', async () => {
    const message: ChatMessage = {
      id: 'm2', threadId: 't1', role: 'assistant', content: 'Drafted a case', createdAt: '2026-01-01T00:00:00Z',
      generatedCaseIds: ['ai-1'],
    }
    await act(async () => {
      render(<ChatMessageBubble message={message} projectId="proj-1" onViewCase={vi.fn()} />)
    })
    expect(screen.getByText('Valid checkout completes order')).toBeInTheDocument()
  })
})
