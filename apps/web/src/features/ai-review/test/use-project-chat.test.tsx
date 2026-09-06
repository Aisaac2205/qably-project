import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { ApiError } from '@/lib/api-client'
import type {
  ChatMessageRecord,
  ChatThreadDetailRecord,
  ChatThreadRecord,
} from '@qably/types'

const thread: ChatThreadRecord = {
  id: 'thread-1',
  projectId: 'proj-1',
  title: 'New conversation',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const assistantMessage: ChatMessageRecord = {
  id: 'message-2',
  threadId: 'thread-1',
  role: 'assistant',
  content: 'This project has 3 suites.',
  suggestedCases: [],
  createdAt: '2026-01-01T00:00:01.000Z',
}

const threadDetail: ChatThreadDetailRecord = {
  ...thread,
  messages: [
    {
      id: 'message-1',
      threadId: 'thread-1',
      role: 'user',
      content: 'How many suites exist?',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:00.500Z',
    },
    assistantMessage,
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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useProjectChat', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts in draft state with activeThreadId null', async () => {
    listThreads.mockResolvedValue([thread])
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })

    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
    await waitFor(() => expect(result.current.threads).toEqual([thread]))
  })

  it('selects an existing thread and loads its messages', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })
    await waitFor(() => expect(result.current.threads).toEqual([thread]))

    act(() => {
      result.current.selectThread('thread-1')
    })

    await waitFor(() => expect(result.current.messages.length).toBe(2))
    expect(getThread).toHaveBeenCalledWith('proj-1', 'thread-1', expect.anything())
  })

  it('creates a thread and sends the first message in draft state', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(thread)
    sendMessage.mockResolvedValue(assistantMessage)
    getThread.mockResolvedValue(threadDetail)
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })
    await waitFor(() => expect(result.current.threads).toEqual([]))

    await act(async () => {
      await result.current.send('How many suites exist?')
    })

    expect(createThread).toHaveBeenCalledWith('proj-1')
    expect(sendMessage).toHaveBeenCalledWith('proj-1', 'thread-1', 'How many suites exist?')
    expect(result.current.activeThreadId).toBe('thread-1')
    expect(result.current.pendingMessage).toBeNull()
  })

  it('clears the pending bubble and keeps only an assistant-unavailable notice once the persisted user message comes back', async () => {
    listThreads.mockResolvedValue([thread])
    const persistedUserMessage: ChatMessageRecord = {
      id: 'message-3',
      threadId: 'thread-1',
      role: 'user',
      content: 'Another question',
      suggestedCases: [],
      createdAt: '2026-01-01T00:00:02.000Z',
    }
    getThread.mockResolvedValue({
      ...threadDetail,
      messages: [...threadDetail.messages, persistedUserMessage],
    })
    sendMessage.mockRejectedValue(new ApiError(503, 'unavailable', 'provider-unavailable'))
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })
    await waitFor(() => expect(result.current.threads).toEqual([thread]))

    act(() => {
      result.current.selectThread('thread-1')
    })
    await waitFor(() => expect(result.current.messages.length).toBe(3))

    await act(async () => {
      await result.current.send('Another question')
    })

    expect(result.current.pendingMessage).toEqual({
      status: 'unavailable',
      errorKind: 'provider-unavailable',
    })
  })

  it('classifies a coded ai-not-enabled 403 distinctly from an uncoded forbidden 403', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    sendMessage
      .mockRejectedValueOnce(new ApiError(403, 'Forbidden', 'ai-not-enabled'))
      .mockRejectedValueOnce(new ApiError(403, 'Forbidden'))
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })
    await waitFor(() => expect(result.current.threads).toEqual([thread]))

    act(() => {
      result.current.selectThread('thread-1')
    })
    await waitFor(() => expect(result.current.messages.length).toBe(2))

    await act(async () => {
      await result.current.send('Question one')
    })
    expect(result.current.pendingMessage).toMatchObject({ errorKind: 'ai-not-enabled' })

    await act(async () => {
      await result.current.send('Question two')
    })
    expect(result.current.pendingMessage).toMatchObject({ errorKind: 'forbidden' })
  })

  it('reports isLoadingThread while a selected thread has not resolved yet', async () => {
    listThreads.mockResolvedValue([thread])
    let resolveThread: (value: ChatThreadDetailRecord) => void = () => {}
    getThread.mockReturnValue(
      new Promise((resolve) => {
        resolveThread = resolve
      }),
    )
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })
    await waitFor(() => expect(result.current.threads).toEqual([thread]))

    act(() => {
      result.current.selectThread('thread-1')
    })

    await waitFor(() => expect(result.current.isLoadingThread).toBe(true))

    await act(async () => {
      resolveThread(threadDetail)
    })

    await waitFor(() => expect(result.current.isLoadingThread).toBe(false))
  })

  it('resets to draft state when startNewChat is called', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    const { result } = renderHook(() => useProjectChat('proj-1'), { wrapper })
    await waitFor(() => expect(result.current.threads).toEqual([thread]))

    act(() => {
      result.current.selectThread('thread-1')
    })
    await waitFor(() => expect(result.current.activeThreadId).toBe('thread-1'))

    act(() => {
      result.current.startNewChat()
    })

    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
  })
})
