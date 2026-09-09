import type {
  ChatMessageRecord,
  ChatSendToReviewRecord,
  ChatThreadDetailRecord,
  ChatThreadRecord,
} from '@qably/types'
import { apiRequest } from '@/lib/api-client'

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

export function sendMessage(
  projectId: string,
  threadId: string,
  content: string,
): Promise<ChatMessageRecord> {
  return apiRequest<ChatMessageRecord>(
    `/projects/${projectId}/chat/threads/${threadId}/messages`,
    { method: 'POST', body: { content } },
  )
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
