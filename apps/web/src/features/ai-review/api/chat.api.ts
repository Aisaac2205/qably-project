import type {
  ChatSendToReviewRecord,
  ChatThreadDetailRecord,
  ChatThreadRecord,
} from '@qably/types'
import { apiRequest, apiStream } from '@/lib/api-client'
import {
  readChatStream,
  type ChatStreamDone,
  type ChatStreamOptions,
} from '../lib/chat-stream'

export function listThreads(
  projectId: string,
  signal?: AbortSignal,
): Promise<ChatThreadRecord[]> {
  return apiRequest<ChatThreadRecord[]>(
    `/projects/${projectId}/chat/threads`,
    { signal },
  )
}

export function createThread(
  projectId: string,
  title?: string,
): Promise<ChatThreadRecord> {
  return apiRequest<ChatThreadRecord>(`/projects/${projectId}/chat/threads`, {
    method: 'POST',
    body: title === undefined ? {} : { title },
  })
}

export function deleteThread(
  projectId: string,
  threadId: string,
): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/chat/threads/${threadId}`, {
    method: 'DELETE',
  })
}

export function getThread(
  projectId: string,
  threadId: string,
  signal?: AbortSignal,
): Promise<ChatThreadDetailRecord> {
  return apiRequest<ChatThreadDetailRecord>(
    `/projects/${projectId}/chat/threads/${threadId}`,
    { signal },
  )
}

export interface ChatMessageInput {
  content: string
  caseIds?: string[]
  filePath?: string
}

/**
 * Sends a message and streams the assistant reply. Resolves with the canonical
 * user and assistant rows once the server reports the reply as done.
 */
export async function streamMessage(
  projectId: string,
  threadId: string,
  { content, caseIds = [], filePath }: ChatMessageInput,
  options: ChatStreamOptions = {},
): Promise<ChatStreamDone> {
  const body: ChatMessageInput = { content }
  if (caseIds.length > 0) body.caseIds = caseIds
  if (filePath !== undefined) body.filePath = filePath

  const stream = await apiStream(
    `/projects/${projectId}/chat/threads/${threadId}/messages/stream`,
    { method: 'POST', body, signal: options.signal },
  )

  return readChatStream(stream, options)
}

export function sendToReview(
  projectId: string,
  threadId: string,
  messageId: string,
  caseIndex: number,
): Promise<ChatSendToReviewRecord> {
  return apiRequest<ChatSendToReviewRecord>(
    `/projects/${projectId}/chat/threads/${threadId}/messages/${messageId}/proposals`,
    { method: 'POST', body: { caseIndex } },
  )
}
