import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectChatPanel } from '@/features/ai-review/components/project-chat-panel'
import { ApiError } from '@/lib/api-client'
import type {
  ChatMessageRecord,
  ChatThreadDetailRecord,
  ChatThreadRecord,
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

vi.mock('@/features/ai-review/api/chat.api', () => ({
  listThreads: (...args: unknown[]) => listThreads(...args),
  createThread: (...args: unknown[]) => createThread(...args),
  getThread: (...args: unknown[]) => getThread(...args),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
  sendToReview: (...args: unknown[]) => sendToReview(...args),
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
    getThread.mockResolvedValue({ ...thread, messages: [] })
    const user = userEvent.setup()

    await act(async () => {
      renderPanel()
    })

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Another question{enter}')

    expect(await screen.findByText('Another question')).toBeInTheDocument()
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument()
  })
})
