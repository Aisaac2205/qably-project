import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChatMessageList } from '@/features/ai-review/components/chat-message-list'
import type { ChatMessage } from '@qably/types'

describe('ChatMessageList', () => {
  it('renders every message in order', async () => {
    const messages: ChatMessage[] = [
      { id: 'm1', threadId: 't1', role: 'user', content: 'First', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm2', threadId: 't1', role: 'assistant', content: 'Second', createdAt: '2026-01-01T00:01:00Z' },
    ]
    await act(async () => {
      render(<ChatMessageList messages={messages} onViewCase={vi.fn()} />)
    })
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('shows greeting and hint in empty state when there are no messages', async () => {
    await act(async () => {
      render(<ChatMessageList messages={[]} onViewCase={vi.fn()} />)
    })
    expect(screen.getByText(/how can I help you today|en qué puedo ayudarte hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/ask anything|pregunta cualquier cosa/i)).toBeInTheDocument()
  })
})
