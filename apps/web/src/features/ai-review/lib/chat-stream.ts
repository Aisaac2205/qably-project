import type { ChatMessageRecord, SuggestedCaseRecord } from '@qably/types'
import { ApiError } from '@/lib/api-client'

export interface ServerSentEvent {
  event: string
  data: string
}

export interface ChatStreamDelta {
  text: string
}

export interface ChatStreamCase {
  index: number
  case: SuggestedCaseRecord
}

export interface ChatStreamDone {
  userMessage: ChatMessageRecord
  assistantMessage: ChatMessageRecord
}

export interface ChatStreamFailure {
  code: string
  message: string
}

export interface ChatStreamOptions {
  signal?: AbortSignal
  onDelta?: (text: string) => void
  /** A suggested case as soon as it finishes streaming, before the reply is done. */
  onCase?: (index: number, suggestedCase: SuggestedCaseRecord) => void
}

/**
 * A failure that happens after the stream opened. The server has already stored
 * the user message by then, so callers refetch the thread instead of keeping a
 * local copy of the question.
 */
export class ChatStreamError extends ApiError {
  constructor(message: string, code: string) {
    super(200, message, code)
    this.name = 'ChatStreamError'
  }
}

export function isAbortError(error: unknown): boolean {
  // DOMException does not extend Error in every runtime, so match on the name.
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * Incremental parser for the text/event-stream format. Chunks may split lines,
 * fields or line endings anywhere; LF, CRLF and bare CR all end a line, and a
 * blank line dispatches the event built so far.
 */
export function createSseParser(onEvent: (event: ServerSentEvent) => void) {
  let pendingLine = ''
  let afterCarriageReturn = false
  let eventName = ''
  let dataLines: string[] = []

  function dispatch() {
    if (dataLines.length > 0) {
      onEvent({ event: eventName === '' ? 'message' : eventName, data: dataLines.join('\n') })
    }
    eventName = ''
    dataLines = []
  }

  function processLine(line: string) {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') eventName = value
    else if (field === 'data') dataLines.push(value)
  }

  return {
    push(chunk: string) {
      let segmentStart = 0

      for (let index = 0; index < chunk.length; index += 1) {
        const char = chunk[index]

        // The LF of a CRLF can arrive in the next chunk; it ends no new line.
        if (char === '\n' && afterCarriageReturn) {
          afterCarriageReturn = false
          segmentStart = index + 1
          continue
        }
        afterCarriageReturn = false

        if (char === '\n' || char === '\r') {
          processLine(pendingLine + chunk.slice(segmentStart, index))
          pendingLine = ''
          segmentStart = index + 1
          afterCarriageReturn = char === '\r'
        }
      }

      pendingLine += chunk.slice(segmentStart)
    },
  }
}

function abortErrorOf(signal: AbortSignal): Error {
  return isAbortError(signal.reason)
    ? (signal.reason as Error)
    : new DOMException('The chat reply was stopped', 'AbortError')
}

function parsePayload<T>(data: string): T {
  try {
    return JSON.parse(data) as T
  } catch {
    throw new ChatStreamError('The chat stream sent a malformed event', 'stream-malformed')
  }
}

/**
 * Reads a chat reply stream: reports each `delta`, resolves with the canonical
 * rows of `done`, throws a ChatStreamError for an `error` event or a stream that
 * ends early, and rethrows an AbortError when the signal aborts.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  { signal, onDelta, onCase }: ChatStreamOptions = {},
): Promise<ChatStreamDone> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const outcome: { done?: ChatStreamDone; failure?: ChatStreamError } = {}

  const parser = createSseParser(({ event, data }) => {
    if (outcome.done !== undefined || outcome.failure !== undefined) return

    if (event === 'delta') {
      const { text } = parsePayload<ChatStreamDelta>(data)
      if (typeof text === 'string' && text !== '') onDelta?.(text)
    } else if (event === 'case') {
      const payload = parsePayload<ChatStreamCase>(data)
      onCase?.(payload.index, payload.case)
    } else if (event === 'done') {
      outcome.done = parsePayload<ChatStreamDone>(data)
    } else if (event === 'error') {
      const payload = parsePayload<Partial<ChatStreamFailure>>(data)
      outcome.failure = new ChatStreamError(
        payload.message ?? 'The chat reply failed',
        payload.code ?? 'stream-failed',
      )
    }
  })

  const cancelReader = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', cancelReader, { once: true })

  try {
    while (outcome.done === undefined && outcome.failure === undefined) {
      if (signal?.aborted) throw abortErrorOf(signal)

      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch (error) {
        if (signal?.aborted) throw abortErrorOf(signal)
        if (isAbortError(error)) throw error
        throw new ChatStreamError('The chat stream was interrupted', 'stream-interrupted')
      }

      if (signal?.aborted) throw abortErrorOf(signal)
      if (chunk.done) break

      parser.push(decoder.decode(chunk.value, { stream: true }))
    }
  } catch (error) {
    cancelReader()
    throw error
  } finally {
    signal?.removeEventListener('abort', cancelReader)
  }

  // The reply is complete (or failed) once its terminal event arrives; release
  // the connection instead of waiting for the server to close it.
  cancelReader()

  if (outcome.failure !== undefined) throw outcome.failure
  if (outcome.done === undefined) {
    throw new ChatStreamError('The chat stream ended before the reply completed', 'stream-interrupted')
  }

  return outcome.done
}
