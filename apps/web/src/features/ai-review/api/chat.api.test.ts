import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createThread,
  getThread,
  listThreads,
  sendMessage,
  sendToReview,
} from './chat.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
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

  it('sends a message to a thread', async () => {
    await sendMessage('proj-1', 'thread-1', 'What suites have the most cases?')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/projects\/proj-1\/chat\/threads\/thread-1\/messages$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(
      JSON.stringify({ content: 'What suites have the most cases?' }),
    )
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
