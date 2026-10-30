import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { ApiError } from '@/lib/api-client'
import { ChatStreamError, type ChatStreamDone } from '@/features/ai-review/lib/chat-stream'
import { chatKeys } from '@/features/ai-review/lib/query-keys'
import type {
  AttachedCaseRecord,
  ChatMessageRecord,
  ChatThreadDetailRecord,
  ChatThreadRecord,
  SuggestedCaseRecord,
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

const storedQuestion: ChatMessageRecord = {
  id: 'message-3',
  threadId: 'thread-1',
  role: 'user',
  content: 'Another question',
  suggestedCases: [],
  attachedCases: [],
  createdAt: '2026-01-01T00:00:02.000Z',
}

const canonicalReply: ChatMessageRecord = {
  id: 'message-4',
  threadId: 'thread-1',
  role: 'assistant',
  content: 'Canonical reply',
  suggestedCases: [],
  createdAt: '2026-01-01T00:00:03.000Z',
}

const doneRows: ChatStreamDone = { userMessage: storedQuestion, assistantMessage: canonicalReply }

const listThreads = vi.fn()
const createThread = vi.fn()
const getThread = vi.fn()
const streamMessage = vi.fn()
const sendToReview = vi.fn()
const deleteThread = vi.fn()

vi.mock('@/features/ai-review/api/chat.api', () => ({
  listThreads: (...args: unknown[]) => listThreads(...args),
  createThread: (...args: unknown[]) => createThread(...args),
  getThread: (...args: unknown[]) => getThread(...args),
  streamMessage: (...args: unknown[]) => streamMessage(...args),
  sendToReview: (...args: unknown[]) => sendToReview(...args),
  deleteThread: (...args: unknown[]) => deleteThread(...args),
}))

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  const hook = renderHook(() => useProjectChat('proj-1'), { wrapper })
  return { ...hook, client }
}

interface StreamOptions {
  signal?: AbortSignal
  onDelta?: (text: string) => void
  onCase?: (index: number, suggestedCase: SuggestedCaseRecord) => void
}

function controllableStream() {
  const control: {
    options: StreamOptions
    finish: (rows: ChatStreamDone) => void
    fail: (error: unknown) => void
  } = { options: {}, finish: () => {}, fail: () => {} }

  streamMessage.mockImplementation(
    (_projectId: string, _threadId: string, _body: unknown, options: StreamOptions = {}) => {
      control.options = options
      return new Promise<ChatStreamDone>((resolve, reject) => {
        control.finish = resolve
        control.fail = reject
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      })
    },
  )

  return {
    emit: (text: string) => control.options.onDelta?.(text),
    emitCase: (index: number, suggestedCase: SuggestedCaseRecord) =>
      control.options.onCase?.(index, suggestedCase),
    finish: (rows: ChatStreamDone) => control.finish(rows),
    fail: (error: unknown) => control.fail(error),
    signal: () => control.options.signal,
  }
}

async function openThread(result: { current: ReturnType<typeof useProjectChat> }, count = 2) {
  await waitFor(() => expect(result.current.threads).toEqual([thread]))
  act(() => {
    result.current.selectThread('thread-1')
  })
  await waitFor(() => expect(result.current.messages.length).toBe(count))
}

describe('useProjectChat', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts in draft state with activeThreadId null', async () => {
    listThreads.mockResolvedValue([thread])
    const { result } = setup()

    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.streamingText).toBe('')
    await waitFor(() => expect(result.current.threads).toEqual([thread]))
  })

  it('selects an existing thread and loads its messages', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    const { result } = setup()

    await openThread(result)

    expect(getThread).toHaveBeenCalledWith('proj-1', 'thread-1', expect.anything())
  })

  it('creates a thread and streams the first message in draft state', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(thread)
    streamMessage.mockResolvedValue({
      userMessage: threadDetail.messages[0],
      assistantMessage,
    })
    getThread.mockResolvedValue(threadDetail)
    const { result } = setup()
    await waitFor(() => expect(result.current.threads).toEqual([]))

    await act(async () => {
      await result.current.send('How many suites exist?')
    })

    expect(createThread).toHaveBeenCalledWith('proj-1')
    expect(streamMessage).toHaveBeenCalledWith(
      'proj-1',
      'thread-1',
      { content: 'How many suites exist?', caseIds: [] },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onDelta: expect.any(Function),
        onCase: expect.any(Function),
      }),
    )
    expect(result.current.activeThreadId).toBe('thread-1')
    expect(result.current.pendingMessage).toBeNull()
    expect(result.current.messages.map((message) => message.content)).toEqual([
      'How many suites exist?',
      'This project has 3 suites.',
    ])
  })

  it('accumulates the streamed reply text and reports the chat as running', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    const stream = controllableStream()
    const { result } = setup()
    await openThread(result)

    act(() => {
      void result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())

    expect(result.current.isRunning).toBe(true)
    expect(result.current.streamingText).toBe('')
    expect(result.current.pendingMessage).toMatchObject({
      content: 'Another question',
      status: 'sending',
    })

    act(() => {
      stream.emit('This ')
      stream.emit('project')
    })

    expect(result.current.streamingText).toBe('This project')
    expect(result.current.isRunning).toBe(true)

    await act(async () => {
      stream.finish(doneRows)
    })
  })

  it('accumulates streamed case previews by index and clears them once the reply settles', async () => {
    const firstCase: SuggestedCaseRecord = {
      title: 'Rejects an expired card',
      objective: 'Confirm expired cards are refused',
      preconditions: [],
      steps: ['Open checkout'],
      expectedResult: 'The payment is refused',
      priority: 'high',
    }
    const secondCase: SuggestedCaseRecord = { ...firstCase, title: 'Accepts a valid card' }
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    const stream = controllableStream()
    const { result } = setup()
    await openThread(result)

    act(() => {
      void result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())
    expect(result.current.streamingCases).toEqual([])

    act(() => {
      stream.emitCase(0, firstCase)
    })
    expect(result.current.streamingCases).toEqual([firstCase])

    act(() => {
      stream.emitCase(1, secondCase)
    })
    expect(result.current.streamingCases).toEqual([firstCase, secondCase])

    await act(async () => {
      stream.finish(doneRows)
    })
    expect(result.current.streamingCases).toEqual([])
  })

  it('writes the canonical done rows into the thread at once, replacing the streamed text', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValueOnce(threadDetail).mockReturnValue(new Promise(() => {}))
    const stream = controllableStream()
    const { result, client } = setup()
    await openThread(result)

    let sending: Promise<void> = Promise.resolve()
    act(() => {
      sending = result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())
    act(() => {
      stream.emit('Streamed reply that a decline replaced')
    })

    await act(async () => {
      stream.finish(doneRows)
      await sending
    })

    expect(result.current.messages.map((message) => message.content)).toEqual([
      'How many suites exist?',
      'This project has 3 suites.',
      'Another question',
      'Canonical reply',
    ])
    expect(result.current.pendingMessage).toBeNull()
    expect(result.current.streamingText).toBe('')
    expect(result.current.isRunning).toBe(false)
    expect(
      client.getQueryData<ChatThreadDetailRecord>(chatKeys.thread('proj-1', 'thread-1'))?.messages,
    ).toHaveLength(4)
  })

  it('keeps the visible thread frozen while streaming so a refetch cannot duplicate the question', async () => {
    listThreads.mockResolvedValue([thread])
    getThread
      .mockResolvedValueOnce(threadDetail)
      .mockResolvedValueOnce({ ...threadDetail, messages: [...threadDetail.messages, storedQuestion] })
      .mockResolvedValue({
        ...threadDetail,
        messages: [...threadDetail.messages, storedQuestion, canonicalReply],
      })
    const stream = controllableStream()
    const { result, client } = setup()
    await openThread(result)

    act(() => {
      void result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())

    await act(async () => {
      await client.invalidateQueries({ queryKey: chatKeys.thread('proj-1', 'thread-1') })
    })

    expect(getThread).toHaveBeenCalledTimes(2)
    expect(result.current.messages).toHaveLength(2)

    await act(async () => {
      stream.finish(doneRows)
    })

    expect(result.current.messages.map((message) => message.id)).toEqual([
      'message-1',
      'message-2',
      'message-3',
      'message-4',
    ])
  })

  it('stops the reply on cancel and refetches the thread that stored the question', async () => {
    listThreads.mockResolvedValue([thread])
    getThread
      .mockResolvedValueOnce(threadDetail)
      .mockResolvedValue({ ...threadDetail, messages: [...threadDetail.messages, storedQuestion] })
    const stream = controllableStream()
    const { result } = setup()
    await openThread(result)

    let sending: Promise<void> = Promise.resolve()
    act(() => {
      sending = result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())
    act(() => {
      stream.emit('Partial')
    })

    await act(async () => {
      result.current.cancel()
      await sending
    })

    expect(stream.signal()?.aborted).toBe(true)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.streamingText).toBe('')
    expect(result.current.pendingMessage).toBeNull()
    expect(getThread).toHaveBeenCalledTimes(2)
    expect(result.current.messages.map((message) => message.content)).toEqual([
      'How many suites exist?',
      'This project has 3 suites.',
      'Another question',
    ])
  })

  it('shows the unavailable notice when the provider fails after the reply started', async () => {
    listThreads.mockResolvedValue([thread])
    getThread
      .mockResolvedValueOnce(threadDetail)
      .mockResolvedValue({ ...threadDetail, messages: [...threadDetail.messages, storedQuestion] })
    const stream = controllableStream()
    const { result } = setup()
    await openThread(result)

    let sending: Promise<void> = Promise.resolve()
    act(() => {
      sending = result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())
    act(() => {
      stream.emit('Partial')
    })

    await act(async () => {
      stream.fail(new ChatStreamError('Model went away', 'provider-unavailable'))
      await sending
    })

    expect(result.current.pendingMessage).toEqual({
      status: 'unavailable',
      errorKind: 'provider-unavailable',
    })
    expect(result.current.streamingText).toBe('')
    expect(result.current.isRunning).toBe(false)
    expect(result.current.messages).toHaveLength(3)
  })

  it('reports an interrupted stream without repeating the question the server already stored', async () => {
    listThreads.mockResolvedValue([thread])
    getThread
      .mockResolvedValueOnce(threadDetail)
      .mockResolvedValue({ ...threadDetail, messages: [...threadDetail.messages, storedQuestion] })
    streamMessage.mockRejectedValue(new ChatStreamError('Cut off', 'stream-interrupted'))
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.send('Another question')
    })

    expect(result.current.pendingMessage).toEqual({ status: 'error', errorKind: 'error' })
    expect(result.current.messages).toHaveLength(3)
  })

  it('lets a reply finish in the background when another conversation is opened', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValueOnce(threadDetail).mockReturnValue(new Promise(() => {}))
    const stream = controllableStream()
    const { result, client } = setup()
    await openThread(result)

    let sending: Promise<void> = Promise.resolve()
    act(() => {
      sending = result.current.send('Another question')
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())

    act(() => {
      result.current.startNewChat()
    })
    expect(result.current.isRunning).toBe(false)

    await act(async () => {
      stream.finish(doneRows)
      await sending
    })

    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.pendingMessage).toBeNull()
    expect(result.current.isRunning).toBe(false)
    expect(
      client.getQueryData<ChatThreadDetailRecord>(chatKeys.thread('proj-1', 'thread-1'))?.messages,
    ).toHaveLength(4)
  })

  it('clears the pending bubble and keeps only an assistant-unavailable notice once the persisted user message comes back', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue({
      ...threadDetail,
      messages: [...threadDetail.messages, storedQuestion],
    })
    streamMessage.mockRejectedValue(new ApiError(503, 'unavailable', 'provider-unavailable'))
    const { result } = setup()
    await openThread(result, 3)

    await act(async () => {
      await result.current.send('Another question')
    })

    expect(result.current.pendingMessage).toEqual({
      status: 'unavailable',
      errorKind: 'provider-unavailable',
    })
  })

  it('classifies a coded quota-exhausted 503 distinctly from an uncoded provider-unavailable 503', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue({
      ...threadDetail,
      messages: [...threadDetail.messages, storedQuestion],
    })
    streamMessage.mockRejectedValue(new ApiError(503, 'Daily budget spent', 'quota-exhausted'))
    const { result } = setup()
    await openThread(result, 3)

    await act(async () => {
      await result.current.send('Budget question')
    })

    expect(result.current.pendingMessage).toEqual({
      status: 'unavailable',
      errorKind: 'quota-exhausted',
    })
  })

  it('classifies a coded ai-not-enabled 403 distinctly from an uncoded forbidden 403', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    streamMessage
      .mockRejectedValueOnce(new ApiError(403, 'Forbidden', 'ai-not-enabled'))
      .mockRejectedValueOnce(new ApiError(403, 'Forbidden'))
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.send('Question one')
    })
    expect(result.current.pendingMessage).toMatchObject({
      content: 'Question one',
      status: 'error',
      errorKind: 'ai-not-enabled',
    })

    await act(async () => {
      await result.current.send('Question two')
    })
    expect(result.current.pendingMessage).toMatchObject({ errorKind: 'forbidden' })
  })

  it('sends the attached case ids and keeps the case data on the pending bubble', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(thread)
    getThread.mockResolvedValue(threadDetail)
    const stream = controllableStream()
    const attachedCase: AttachedCaseRecord = {
      id: 'tc-1',
      name: 'Valid login redirects to dashboard',
      suiteName: 'Authentication',
    }
    const { result } = setup()
    await waitFor(() => expect(result.current.threads).toEqual([]))

    act(() => {
      void result.current.send('Improve this case', [attachedCase])
    })
    await waitFor(() => expect(streamMessage).toHaveBeenCalled())

    expect(streamMessage).toHaveBeenCalledWith(
      'proj-1',
      'thread-1',
      { content: 'Improve this case', caseIds: ['tc-1'] },
      expect.anything(),
    )
    expect(result.current.pendingMessage?.attachedCases).toEqual([attachedCase])

    await act(async () => {
      stream.finish(doneRows)
    })
  })

  it('forwards a typed file path to the stream', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(thread)
    streamMessage.mockResolvedValue(doneRows)
    getThread.mockResolvedValue(threadDetail)
    const { result } = setup()
    await waitFor(() => expect(result.current.threads).toEqual([]))

    await act(async () => {
      await result.current.send('Look at this file', [], 'src/foo.ts')
    })

    expect(streamMessage).toHaveBeenCalledWith(
      'proj-1',
      'thread-1',
      { content: 'Look at this file', caseIds: [], filePath: 'src/foo.ts' },
      expect.anything(),
    )
  })

  it('classifies a file-unreadable 422 distinctly from other errors', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    streamMessage.mockRejectedValue(new ApiError(422, 'Unreadable', 'file-unreadable'))
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.send('Look at this file', [], 'src/missing.ts')
    })

    expect(result.current.pendingMessage).toMatchObject({ errorKind: 'file-unreadable' })
  })

  it('classifies a too-many-cases 400 distinctly from a plain too-long 400', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    streamMessage.mockRejectedValue(new ApiError(400, 'Too many cases', 'too-many-cases'))
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.send('Improve these cases')
    })

    expect(result.current.pendingMessage).toMatchObject({ errorKind: 'too-many-cases' })
  })

  it('classifies a 400 validation error as too-long', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    streamMessage.mockRejectedValue(new ApiError(400, 'Message too long'))
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.send('A'.repeat(4001))
    })

    expect(result.current.pendingMessage).toMatchObject({ errorKind: 'too-long' })
  })

  it('reports isLoadingThread while a selected thread has not resolved yet', async () => {
    listThreads.mockResolvedValue([thread])
    let resolveThread: (value: ChatThreadDetailRecord) => void = () => {}
    getThread.mockReturnValue(
      new Promise((resolve) => {
        resolveThread = resolve
      }),
    )
    const { result } = setup()
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
    const { result } = setup()
    await openThread(result)

    act(() => {
      result.current.startNewChat()
    })

    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
  })

  it('returns to draft state after deleting the thread being read', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    deleteThread.mockResolvedValue(undefined)
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.removeThread('thread-1')
    })

    expect(deleteThread).toHaveBeenCalledWith('proj-1', 'thread-1')
    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
  })

  it('keeps reading the open thread when a different one is deleted', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    deleteThread.mockResolvedValue(undefined)
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.removeThread('thread-2')
    })

    expect(result.current.activeThreadId).toBe('thread-1')
  })

  it('surfaces a delete failure without dropping the open thread', async () => {
    listThreads.mockResolvedValue([thread])
    getThread.mockResolvedValue(threadDetail)
    deleteThread.mockRejectedValue(new ApiError(500, 'nope'))
    const { result } = setup()
    await openThread(result)

    await act(async () => {
      await result.current.removeThread('thread-1')
    })

    expect(result.current.activeThreadId).toBe('thread-1')
    await waitFor(() => expect(result.current.deleteError).toBe(true))
  })
})
