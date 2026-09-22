import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatMessageList } from '@/features/ai-review/components/chat-message-list'
import type { AttachedCaseRecord, ChatMessageRecord } from '@qably/types'
import { renderWithQuery } from '@/lib/query-test-utils'

describe('ChatMessageList', () => {
  it('renders every message in order', async () => {
    const messages: ChatMessageRecord[] = [
      { id: 'm1', threadId: 't1', role: 'user', content: 'First', suggestedCases: [], createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm2', threadId: 't1', role: 'assistant', content: 'Second', suggestedCases: [], createdAt: '2026-01-01T00:01:00Z' },
    ]
    await act(async () => {
      render(<ChatMessageList projectId="proj-1" messages={messages} />)
    })
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('shows the loading state instead of the greeting while the selected thread is still loading', async () => {
    await act(async () => {
      render(<ChatMessageList projectId="proj-1" messages={[]} isLoadingThread />)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText(/how can I help you today|en qué puedo ayudarte hoy/i)).not.toBeInTheDocument()
  })

  it('shows greeting and hint in empty state when there are no messages', async () => {
    await act(async () => {
      render(<ChatMessageList projectId="proj-1" messages={[]} />)
    })
    expect(screen.getByText(/how can I help you today|en qué puedo ayudarte hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/ask anything|pregunta cualquier cosa/i)).toBeInTheDocument()
  })

  it('shows an optimistic user bubble while sending', async () => {
    await act(async () => {
      render(
        <ChatMessageList
          projectId="proj-1"
          messages={[]}
          pendingMessage={{ content: 'How many suites exist?', status: 'sending' }}
        />,
      )
    })
    expect(screen.getByText('How many suites exist?')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i)
  })

  it('keeps the user message visible and marks the assistant unavailable', async () => {
    await act(async () => {
      render(
        <ChatMessageList
          projectId="proj-1"
          messages={[]}
          pendingMessage={{ content: 'Another question', status: 'unavailable' }}
        />,
      )
    })
    expect(screen.getByText('Another question')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/not available right now/i)
  })

  it('scopes the live region to only the newest assistant reply, not the entire history', async () => {
    const messages: ChatMessageRecord[] = [
      { id: 'm1', threadId: 't1', role: 'user', content: 'First question', suggestedCases: [], createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm2', threadId: 't1', role: 'assistant', content: 'First answer', suggestedCases: [], createdAt: '2026-01-01T00:01:00Z' },
      { id: 'm3', threadId: 't1', role: 'assistant', content: 'Second answer', suggestedCases: [], createdAt: '2026-01-01T00:02:00Z' },
    ]
    let container: HTMLElement
    await act(async () => {
      ;({ container } = render(<ChatMessageList projectId="proj-1" messages={messages} />))
    })

    const liveRegions = container!.querySelectorAll('[aria-live="polite"]')
    expect(liveRegions).toHaveLength(1)
    expect(liveRegions[0]).not.toHaveTextContent('First question')
    expect(liveRegions[0]).not.toHaveTextContent('First answer')
    expect(liveRegions[0]).not.toHaveTextContent('Second answer')
    expect(liveRegions[0]?.textContent).not.toBe('')
  })

  it('shows a throttled error message', async () => {
    await act(async () => {
      render(
        <ChatMessageList
          projectId="proj-1"
          messages={[]}
          pendingMessage={{ content: 'Hi', status: 'error', errorKind: 'throttled' }}
        />,
      )
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/too many messages/i)
  })

  it('shows a message-too-long error message', async () => {
    await act(async () => {
      render(
        <ChatMessageList
          projectId="proj-1"
          messages={[]}
          pendingMessage={{ content: 'Hi', status: 'error', errorKind: 'too-long' }}
        />,
      )
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/too long/i)
  })

  it('shows a too-many-cases error message', async () => {
    await act(async () => {
      render(
        <ChatMessageList
          projectId="proj-1"
          messages={[]}
          pendingMessage={{ content: 'Hi', status: 'error', errorKind: 'too-many-cases' }}
        />,
      )
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/too many cases/i)
  })

  it('shows no prompt starter cards in the empty state', async () => {
    await act(async () => {
      render(<ChatMessageList projectId="proj-1" messages={[]} />)
    })
    expect(screen.queryByRole('button', { name: /checkout flow|coverage gaps|pending cases/i })).not.toBeInTheDocument()
  })

  it('resolves a targeted proposal against the preceding user message attached cases', async () => {
    const attachedCase: AttachedCaseRecord = {
      id: 'tc-1',
      name: 'Valid login redirects to dashboard',
      suiteName: 'Authentication',
    }
    const messages: ChatMessageRecord[] = [
      {
        id: 'm1',
        threadId: 't1',
        role: 'user',
        content: 'Improve this case',
        suggestedCases: [],
        attachedCases: [attachedCase],
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'm2',
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
        createdAt: '2026-01-01T00:01:00Z',
      },
    ]
    await act(async () => {
      renderWithQuery(<ChatMessageList projectId="proj-1" messages={messages} />)
    })
    expect(screen.getByText('Updates: Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('shows the attached case chips on the optimistic user bubble', async () => {
    await act(async () => {
      render(
        <ChatMessageList
          projectId="proj-1"
          messages={[]}
          pendingMessage={{
            content: 'Improve this case',
            status: 'sending',
            attachedCases: [
              { id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' },
            ],
          }}
        />,
      )
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })
})
