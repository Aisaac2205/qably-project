'use client'

import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createThread,
  getThread,
  listThreads,
  sendMessage,
  sendToReview as sendToReviewRequest,
} from '@/features/ai-review/api/chat.api'
import { chatKeys } from '@/features/ai-review/lib/query-keys'
import { ApiError } from '@/lib/api-client'

export type ChatSendErrorKind =
  | 'provider-unavailable'
  | 'ai-not-enabled'
  | 'throttled'
  | 'error'

export interface PendingMessage {
  content: string
  status: 'sending' | 'unavailable' | 'error'
  errorKind?: ChatSendErrorKind
}

function classifySendError(error: unknown): ChatSendErrorKind {
  if (error instanceof ApiError) {
    if (error.code === 'provider-unavailable' || error.status === 503) {
      return 'provider-unavailable'
    }
    if (error.code === 'ai-not-enabled' || error.status === 403) {
      return 'ai-not-enabled'
    }
    if (error.status === 429) {
      return 'throttled'
    }
  }
  return 'error'
}

export function useProjectChat(projectId: string) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null)

  const threadsQuery = useQuery({
    queryKey: chatKeys.threads(projectId),
    queryFn: ({ signal }) => listThreads(projectId, signal),
  })

  const threadQuery = useQuery({
    queryKey: chatKeys.thread(projectId, activeThreadId ?? ''),
    queryFn: ({ signal }) => getThread(projectId, activeThreadId as string, signal),
    enabled: activeThreadId !== null,
  })

  const startNewChat = useCallback(() => {
    setActiveThreadId(null)
    setPendingMessage(null)
  }, [])

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    setPendingMessage(null)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content) return

      setPendingMessage({ content, status: 'sending' })

      let threadId = activeThreadId

      try {
        if (threadId === null) {
          const thread = await createThread(projectId)
          threadId = thread.id
          setActiveThreadId(threadId)
          void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
        }

        await sendMessage(projectId, threadId, content)

        setPendingMessage(null)
        void queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
        void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
      } catch (error) {
        const kind = classifySendError(error)

        if (kind === 'provider-unavailable' && threadId !== null) {
          void queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
        }

        setPendingMessage({
          content,
          status: kind === 'provider-unavailable' ? 'unavailable' : 'error',
          errorKind: kind,
        })
      }
    },
    [projectId, activeThreadId, queryClient],
  )

  const sendCaseToReview = useCallback(
    (threadId: string, messageId: string, caseIndex: number) =>
      sendToReviewRequest(projectId, threadId, messageId, caseIndex),
    [projectId],
  )

  return {
    threads: threadsQuery.data ?? [],
    isLoadingThreads: threadsQuery.isLoading,
    activeThreadId,
    thread: threadQuery.data,
    messages: threadQuery.data?.messages ?? [],
    isLoadingThread: activeThreadId !== null && threadQuery.isLoading,
    pendingMessage,
    startNewChat,
    selectThread,
    send,
    sendCaseToReview,
  }
}
