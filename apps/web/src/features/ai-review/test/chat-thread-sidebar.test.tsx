import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatThreadSidebar } from '@/features/ai-review/components/chat-thread-sidebar'
import type { ChatThread, ChatMessage } from '@qably/types'

describe('ChatThreadSidebar', () => {
  const threads: ChatThread[] = [
    { id: 't1', projectId: 'proj-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:01:00Z' },
    { id: 't2', projectId: 'proj-1', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:01:00Z' },
  ]
  const messages: ChatMessage[] = [
    { id: 'm1', threadId: 't1', role: 'user', content: 'First thread message', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'm2', threadId: 't2', role: 'user', content: 'Second thread message', createdAt: '2026-01-02T00:00:00Z' },
  ]

  it('renders threads with titles derived from the first user message', async () => {
    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
          onDeleteThread={vi.fn()}
          messages={messages}
        />,
      )
    })

    expect(screen.getByText('First thread message')).toBeInTheDocument()
    expect(screen.getByText('Second thread message')).toBeInTheDocument()
  })

  it('triggers onNewChat when clicking the new chat button', async () => {
    const onNewChat = vi.fn()
    const user = userEvent.setup()

    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={vi.fn()}
          onNewChat={onNewChat}
          onDeleteThread={vi.fn()}
          messages={messages}
        />,
      )
    })

    const newChatButton = screen.getByRole('button', { name: /new chat|nuevo chat/i })
    await user.click(newChatButton)
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('triggers onSelectThread when clicking a thread in the list', async () => {
    const onSelectThread = vi.fn()
    const user = userEvent.setup()

    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={onSelectThread}
          onNewChat={vi.fn()}
          onDeleteThread={vi.fn()}
          messages={messages}
        />,
      )
    })

    await user.click(screen.getByText('Second thread message'))
    expect(onSelectThread).toHaveBeenCalledWith('t2')
  })

  it('opens confirmation dialog and deletes thread on confirmation', async () => {
    const onDeleteThread = vi.fn()
    const user = userEvent.setup()

    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
          onDeleteThread={onDeleteThread}
          messages={messages}
        />,
      )
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete conversation|eliminar conversaci/i })
    await user.click(deleteButtons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: /delete|eliminar/i })
    await user.click(confirmButton)

    expect(onDeleteThread).toHaveBeenCalledWith('t1')
  })

  it('renders empty state when there are no threads', async () => {
    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={[]}
          activeThreadId={null}
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
          onDeleteThread={vi.fn()}
          messages={[]}
        />,
      )
    })

    expect(screen.getByText(/no conversations|sin conversaciones/i)).toBeInTheDocument()
  })
})
