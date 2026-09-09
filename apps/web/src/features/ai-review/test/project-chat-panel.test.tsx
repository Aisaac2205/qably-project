import { render, screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectChatPanel } from '@/features/ai-review/components/project-chat-panel'
import { ApiError } from '@/lib/api-client'
import {
  ASSISTANT_MODEL_NAME,
  type ChatMessageRecord,
  type ChatThreadDetailRecord,
  type ChatThreadRecord,
} from '@qably/types'

const thread: ChatThreadRecord = {
  id: 'thread-1',
  projectId: 'proj-1',
  title: 'How many cases are pending?',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:01.000Z',
}

const assistantReply: ChatMessageRecord = {
  id: 'message-2',
  threadId: 'thread-1',
  role: 'assistant',
  content: 'There are 4 cases pending review.',
  suggestedCases: [],
  createdAt: '2026-01-01T00:00:01.000Z',
}

const threadDetailAfterReply: ChatThreadDetailRecord = {
  ...thread,
  messages: [
    {
      id: 'message-1',
      threadId: 'thread-1',
      role: 'user',
      content: 'How many cases are pending?',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:00.500Z',
    },
    assistantReply,
  ],
}

const listThreads = vi.fn()
const createThread = vi.fn()
const getThread = vi.fn()
const sendMessage = vi.fn()
const sendToReview = vi.fn()
const deleteThread = vi.fn()

vi.mock('@/features/ai-review/api/chat.api', () => ({
  listThreads: (...args: unknown[]) => listThreads(...args),
  createThread: (...args: unknown[]) => createThread(...args),
  getThread: (...args: unknown[]) => getThread(...args),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
  sendToReview: (...args: unknown[]) => sendToReview(...args),
  deleteThread: (...args: unknown[]) => deleteThread(...args),
}))

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ProjectChatPanel projectId="proj-1" />
    </QueryClientProvider>,
  )
}

describe('ProjectChatPanel', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts a new thread and shows the assistant reply after sending a message', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(thread)
    sendMessage.mockResolvedValue(assistantReply)
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await act(async () => {
      renderPanel()
    })
    expect(screen.getByText('What suites have the most pending cases?')).toBeInTheDocument()

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'How many cases are pending?{enter}')

    await waitFor(() => expect(screen.getByText('There are 4 cases pending review.')).toBeInTheDocument())
  })

  it('keeps the user message visible and shows the assistant as unavailable', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(thread)
    sendMessage.mockRejectedValue(new ApiError(503, 'unavailable', 'provider-unavailable'))
    getThread.mockResolvedValue({
      ...thread,
      messages: [
        {
          id: 'message-3',
          threadId: 'thread-1',
          role: 'user',
          content: 'Another question',
          suggestedCases: [],
          createdAt: '2026-01-01T00:00:02.000Z',
        },
      ],
    })
    const user = userEvent.setup()

    await act(async () => {
      renderPanel()
    })

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Another question{enter}')

    expect(await screen.findByText('Another question')).toBeInTheDocument()
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument()
  })

  it('names the model answering, labelled as the model', async () => {
    listThreads.mockResolvedValue([])

    await act(async () => {
      renderPanel()
    })

    const chip = screen.getByText(ASSISTANT_MODEL_NAME)
    expect(chip).toBeInTheDocument()
    expect(chip.parentElement).toHaveTextContent(/model|modelo/i)
  })

  it('titles the panel with the conversation being read', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await act(async () => {
      renderPanel()
    })

    await user.click(await screen.findByTitle('How many cases are pending?'))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'How many cases are pending?' }),
      ).toBeInTheDocument(),
    )
  })

  it('reaches the conversations from a drawer on a narrow viewport', async () => {
    listThreads.mockResolvedValue([thread])
    const user = userEvent.setup()

    await act(async () => {
      renderPanel()
    })

    await user.click(screen.getByRole('button', { name: /open conversations|ver conversaciones/i }))

    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('How many cases are pending?')).toBeInTheDocument()
  })

  it('offers no back control unless an exit is wired', async () => {
    listThreads.mockResolvedValue([])

    await act(async () => {
      renderPanel()
    })

    expect(
      screen.queryByRole('button', { name: /back to the review queue|volver a la cola/i }),
    ).not.toBeInTheDocument()
  })

  it('reports the exit when the back control is used', async () => {
    listThreads.mockResolvedValue([])
    const onExit = vi.fn()
    const user = userEvent.setup()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    })

    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <ProjectChatPanel projectId="proj-1" onExit={onExit} />
        </QueryClientProvider>,
      )
    })

    await user.click(
      screen.getByRole('button', { name: /back to the review queue|volver a la cola/i }),
    )
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('closes the drawer once a conversation is picked', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await act(async () => {
      renderPanel()
    })

    await user.click(screen.getByRole('button', { name: /open conversations|ver conversaciones/i }))
    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByText('How many cases are pending?'))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
