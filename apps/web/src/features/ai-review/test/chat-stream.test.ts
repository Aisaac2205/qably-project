import { describe, expect, it } from 'vitest'
import {
  ChatStreamError,
  createSseParser,
  isAbortError,
  type ServerSentEvent,
} from '@/features/ai-review/lib/chat-stream'
import { ApiError } from '@/lib/api-client'

function parseChunks(chunks: string[]): ServerSentEvent[] {
  const events: ServerSentEvent[] = []
  const parser = createSseParser((event) => events.push(event))
  for (const chunk of chunks) parser.push(chunk)
  return events
}

const twoEvents =
  'event: delta\ndata: {"text":"Hel"}\n\nevent: delta\ndata: {"text":"lo"}\n\n'

describe('createSseParser', () => {
  it('parses one named event', () => {
    expect(parseChunks(['event: delta\ndata: {"text":"Hi"}\n\n'])).toEqual([
      { event: 'delta', data: '{"text":"Hi"}' },
    ])
  })

  it('parses several events delivered in one chunk', () => {
    expect(parseChunks([twoEvents])).toEqual([
      { event: 'delta', data: '{"text":"Hel"}' },
      { event: 'delta', data: '{"text":"lo"}' },
    ])
  })

  it('yields the same events whatever position a chunk boundary falls on', () => {
    const expected = parseChunks([twoEvents])

    for (let cut = 1; cut < twoEvents.length; cut += 1) {
      expect(parseChunks([twoEvents.slice(0, cut), twoEvents.slice(cut)])).toEqual(expected)
    }
  })

  it('accepts CRLF line endings, even when the CR and the LF arrive in different chunks', () => {
    const crlf = twoEvents.replaceAll('\n', '\r\n')
    const expected = [
      { event: 'delta', data: '{"text":"Hel"}' },
      { event: 'delta', data: '{"text":"lo"}' },
    ]

    expect(parseChunks([crlf])).toEqual(expected)
    for (let cut = 1; cut < crlf.length; cut += 1) {
      expect(parseChunks([crlf.slice(0, cut), crlf.slice(cut)])).toEqual(expected)
    }
  })

  it('accepts bare CR line endings', () => {
    expect(parseChunks(['event: delta\rdata: {"text":"Hi"}\r\r'])).toEqual([
      { event: 'delta', data: '{"text":"Hi"}' },
    ])
  })

  it('joins a multi-line data field with newlines', () => {
    expect(parseChunks(['event: done\ndata: {"a":\ndata: 1}\n\n'])).toEqual([
      { event: 'done', data: '{"a":\n1}' },
    ])
  })

  it('ignores comments and events that carry no data', () => {
    expect(parseChunks([': keep-alive\n\nevent: ping\n\nevent: delta\ndata: x\n\n'])).toEqual([
      { event: 'delta', data: 'x' },
    ])
  })

  it('names an unnamed event "message" and strips only one leading space from a value', () => {
    expect(parseChunks(['data:  two spaces\n\n'])).toEqual([
      { event: 'message', data: ' two spaces' },
    ])
  })

  it('waits for the blank line before dispatching an event', () => {
    const events: ServerSentEvent[] = []
    const parser = createSseParser((event) => events.push(event))

    parser.push('event: delta\ndata: {"text":"Hi"}\n')
    expect(events).toEqual([])

    parser.push('\n')
    expect(events).toEqual([{ event: 'delta', data: '{"text":"Hi"}' }])
  })
})

describe('ChatStreamError', () => {
  it('is an ApiError so send errors classify it by its code', () => {
    const error = new ChatStreamError('Model down', 'provider-unavailable')

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('provider-unavailable')
    expect(error.message).toBe('Model down')
  })
})

describe('isAbortError', () => {
  it('recognises an abort and nothing else', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true)
    expect(isAbortError(new Error('boom'))).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })
})
