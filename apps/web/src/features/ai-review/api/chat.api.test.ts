import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageRecord } from '@qably/types'
import {
  createThread,
  getThread,
  listThreads,
  sendToReview,
  streamMessage,
} from './chat.api'
import { ApiError } from '@/lib/api-client'
import { ChatStreamError } from '../lib/chat-stream'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

const userMessage: ChatMessageRecord = {
  id: 'message-1',
  threadId: 'thread-1',
  role: 'user',
  content: 'What suites have the most cases?',
  suggestedCases: [],
  attachedCases: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

const assistantMessage: ChatMessageRecord = {
  id: 'message-2',
  threadId: 'thread-1',
  role: 'assistant',
  content: 'Checkout has the most cases.',
  suggestedCases: [],
  createdAt: '2026-01-01T00:00:01.000Z',
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

const doneEvent = sse('done', { userMessage, assistantMessage })

function streamFrom(chunks: (string | Uint8Array)[], { close = true } = {}) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }
      if (close) controller.close()
    },
  })
}

function respondWithStream(chunks: (string | Uint8Array)[], options?: { close?: boolean }) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: streamFrom(chunks, options),
  })
}

describe('chat.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'thread-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists threads for a project', async () => {
    await listThreads('proj-1')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/projects\/proj-1\/chat\/threads$/)
    expect(init.method).toBe('GET')
  })

  it('creates a thread without a title', async () => {
    await createThread('proj-1')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/projects\/proj-1\/chat\/threads$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({}))
  })

  it('creates a thread with a title', async () => {
    await createThread('proj-1', 'Checkout flow')

    const [, init] = lastCall()
    expect(init.body).toBe(JSON.stringify({ title: 'Checkout flow' }))
  })

  it('reads one thread with its messages', async () => {
    await getThread('proj-1', 'thread-1')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/projects\/proj-1\/chat\/threads\/thread-1$/)
    expect(init.method).toBe('GET')
  })

  it('sends a suggested case to review', async () => {
    await sendToReview('proj-1', 'thread-1', 'message-1', 2)

    const [url, init] = lastCall()
    expect(url).toMatch(
      /\/projects\/proj-1\/chat\/threads\/thread-1\/messages\/message-1\/proposals$/,
    )
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ caseIndex: 2 }))
  })
})

describe('streamMessage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('posts the message to the stream endpoint of the thread', async () => {
    respondWithStream([doneEvent])

    await streamMessage('proj-1', 'thread-1', { content: 'What suites have the most cases?' })

    const [url, init] = lastCall()
    expect(url).toMatch(/\/projects\/proj-1\/chat\/threads\/thread-1\/messages\/stream$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: 'What suites have the most cases?' }))
  })

  it('omits caseIds when no case is attached and sends them when some are', async () => {
    respondWithStream([doneEvent])
    await streamMessage('proj-1', 'thread-1', { content: 'Hello', caseIds: [] })
    expect(lastCall()[1].body).toBe(JSON.stringify({ content: 'Hello' }))

    respondWithStream([doneEvent])
    await streamMessage('proj-1', 'thread-1', { content: 'Improve', caseIds: ['tc-1', 'tc-2'] })
    expect(lastCall()[1].body).toBe(JSON.stringify({ content: 'Improve', caseIds: ['tc-1', 'tc-2'] }))
  })

  it('sends an attached file path next to the attached cases', async () => {
    respondWithStream([doneEvent])

    await streamMessage('proj-1', 'thread-1', {
      content: 'Improve this',
      caseIds: ['tc-1'],
      filePath: 'src/foo.ts',
    })

    expect(lastCall()[1].body).toBe(
      JSON.stringify({ content: 'Improve this', caseIds: ['tc-1'], filePath: 'src/foo.ts' }),
    )
  })

  it('reports every delta in order and resolves with the canonical rows of the done event', async () => {
    respondWithStream([
      sse('delta', { text: 'Checkout ' }),
      sse('delta', { text: 'has' }),
      sse('delta', { text: ' the most.' }),
      doneEvent,
    ])
    const deltas: string[] = []

    const result = await streamMessage(
      'proj-1',
      'thread-1',
      { content: 'What suites have the most cases?' },
      { onDelta: (text) => deltas.push(text) },
    )

    expect(deltas).toEqual(['Checkout ', 'has', ' the most.'])
    expect(result).toEqual({ userMessage, assistantMessage })
  })

  it('decodes a multi-byte character split across two network chunks', async () => {
    const bytes = new TextEncoder().encode(sse('delta', { text: 'Configuración' }))
    const splitAt = bytes.indexOf(0xc3) + 1
    respondWithStream([bytes.slice(0, splitAt), bytes.slice(splitAt), doneEvent])
    const deltas: string[] = []

    await streamMessage('proj-1', 'thread-1', { content: 'Hola' }, { onDelta: (text) => deltas.push(text) })

    expect(deltas).toEqual(['Configuración'])
  })

  it('throws the ApiError of a request that fails before the stream opens', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({ statusCode: 503, code: 'provider-unavailable', message: 'Model down' }),
    })

    const failure = streamMessage('proj-1', 'thread-1', { content: 'Hello' })

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.not.toBeInstanceOf(ChatStreamError)
    await expect(failure).rejects.toMatchObject({ status: 503, code: 'provider-unavailable' })
  })

  it('throws a ChatStreamError carrying the code of an error event', async () => {
    respondWithStream([
      sse('delta', { text: 'Partial' }),
      sse('error', { code: 'provider-unavailable', message: 'Model went away' }),
    ])

    const failure = streamMessage('proj-1', 'thread-1', { content: 'Hello' })

    await expect(failure).rejects.toBeInstanceOf(ChatStreamError)
    await expect(failure).rejects.toMatchObject({
      code: 'provider-unavailable',
      message: 'Model went away',
    })
  })

  it('throws a ChatStreamError when the stream ends without a done event', async () => {
    respondWithStream([sse('delta', { text: 'Partial' })])

    await expect(streamMessage('proj-1', 'thread-1', { content: 'Hello' })).rejects.toMatchObject({
      name: 'ChatStreamError',
      code: 'stream-interrupted',
    })
  })

  it('throws a ChatStreamError when an event carries malformed json', async () => {
    respondWithStream(['event: delta\ndata: {not json\n\n'])

    await expect(streamMessage('proj-1', 'thread-1', { content: 'Hello' })).rejects.toMatchObject({
      name: 'ChatStreamError',
      code: 'stream-malformed',
    })
  })

  it('rethrows an AbortError when the caller aborts while the reply streams', async () => {
    respondWithStream([sse('delta', { text: 'Partial' })], { close: false })
    const controller = new AbortController()
    const deltas: string[] = []

    const failure = streamMessage(
      'proj-1',
      'thread-1',
      { content: 'Hello' },
      {
        signal: controller.signal,
        onDelta: (text) => {
          deltas.push(text)
          controller.abort()
        },
      },
    )

    await expect(failure).rejects.toMatchObject({ name: 'AbortError' })
    expect(deltas).toEqual(['Partial'])
    expect(lastCall()[1].signal).toBe(controller.signal)
  })
})
