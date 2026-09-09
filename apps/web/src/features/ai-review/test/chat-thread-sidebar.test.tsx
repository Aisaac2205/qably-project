import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatThreadSidebar } from '@/features/ai-review/components/chat-thread-sidebar'
import type { ChatThreadRecord } from '@qably/types'

describe('ChatThreadSidebar', () => {
  const threads: ChatThreadRecord[] = [
    { id: 't1', projectId: 'proj-1', title: 'First thread message', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:01:00Z' },
    { id: 't2', projectId: 'proj-1', title: 'Second thread message', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:01:00Z' },
  ]

  it('renders threads by their title', async () => {
    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
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
        />,
      )
    })

    await user.click(screen.getByText('Second thread message'))
    expect(onSelectThread).toHaveBeenCalledWith('t2')
  })

  it('renders empty state when there are no threads', async () => {
    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={[]}
          activeThreadId={null}
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
        />,
      )
    })

    expect(screen.getByText(/no conversations|sin conversaciones/i)).toBeInTheDocument()
  })

  it('triggers onToggleCollapse when clicking the sidebar trigger button in expanded state', async () => {
    const onToggleCollapse = vi.fn()
    const user = userEvent.setup()

    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={onToggleCollapse}
        />,
      )
    })

    const triggerButton = screen.getByRole('button', { name: /collapse sidebar|ocultar barra lateral/i })
    expect(triggerButton).toHaveAttribute('aria-expanded', 'true')
    await user.click(triggerButton)
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })

  it('asks for confirmation before deleting a conversation', async () => {
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
        />,
      )
    })

    const deleteButtons = screen.getAllByRole('button', {
      name: /delete conversation|eliminar conversación/i,
    })
    await user.click(deleteButtons[1])
    expect(onDeleteThread).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^(delete|eliminar)$/i }))
    expect(onDeleteThread).toHaveBeenCalledWith('t2')
  })

  it('selecting a conversation is not triggered by its delete button', async () => {
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
        />,
      )
    })

    const deleteButtons = screen.getAllByRole('button', {
      name: /delete conversation|eliminar conversación/i,
    })
    await user.click(deleteButtons[1])
    expect(onSelectThread).not.toHaveBeenCalled()
  })

  it('offers no delete affordance when deletion is not wired', async () => {
    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={vi.fn()}
          onNewChat={vi.fn()}
        />,
      )
    })

    expect(
      screen.queryAllByRole('button', {
        name: /delete conversation|eliminar conversación/i,
      }),
    ).toHaveLength(0)
  })

  it('renders compact icons and triggers onToggleCollapse when collapsed', async () => {
    const onToggleCollapse = vi.fn()
    const onSelectThread = vi.fn()
    const user = userEvent.setup()

    await act(async () => {
      render(
        <ChatThreadSidebar
          threads={threads}
          activeThreadId="t1"
          onSelectThread={onSelectThread}
          onNewChat={vi.fn()}
          isCollapsed={true}
          onToggleCollapse={onToggleCollapse}
        />,
      )
    })

    const expandButton = screen.getByRole('button', { name: /expand sidebar|mostrar barra lateral/i })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(expandButton)
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)

    const threadButtons = screen.getAllByRole('button', { name: /First thread message/i })
    await user.click(threadButtons[0])
    expect(onSelectThread).toHaveBeenCalledWith('t1')
  })
})
