import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Mock } from 'vitest'
import type { ChatMessageRecord, ChatThreadRecord, SuggestedCaseRecord } from '@qably/types'
import { ProjectChatPanel } from '@/features/ai-review/components/project-chat-panel'
import type { ChatStreamDone } from '@/features/ai-review/lib/chat-stream'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { mockSuites } from '@/lib/mock-data'

export const projectSuites = mockSuites.filter((suite) => suite.projectId === 'proj-1')

export const chatThread: ChatThreadRecord = {
  id: 'thread-1',
  projectId: 'proj-1',
  title: 'How many cases are pending?',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:01.000Z',
}

export function userRecord(id: string, content: string, extra: Partial<ChatMessageRecord> = {}): ChatMessageRecord {
  return {
    id,
    threadId: 'thread-1',
    role: 'user',
    content,
    suggestedCases: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

export function assistantRecord(
  id: string,
  content: string,
  extra: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
  return {
    id,
    threadId: 'thread-1',
    role: 'assistant',
    content,
    suggestedCases: [],
    createdAt: '2026-01-01T00:00:01.000Z',
    ...extra,
  }
}

export function createTestClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
}

export function renderChatPanel({
  client = createTestClient(),
  seedSuites = true,
  onExit,
}: { client?: QueryClient; seedSuites?: boolean; onExit?: () => void } = {}) {
  if (seedSuites) client.setQueryData(suiteKeys.list('proj-1'), projectSuites)

  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ProjectChatPanel projectId="proj-1" onExit={onExit} />
      </QueryClientProvider>,
    ),
  }
}

interface StreamOptions {
  signal?: AbortSignal
  onDelta?: (text: string) => void
  onCase?: (index: number, suggestedCase: SuggestedCaseRecord) => void
}

/** Drives a mocked streamMessage by hand: emit deltas, then finish or fail. */
export function controlStream(streamMessage: Mock) {
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
