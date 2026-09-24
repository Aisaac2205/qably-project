'use client'

import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AttachedCaseRecord } from '@qably/types'
import {
  createThread,
  deleteThread,
  getThread,
  listThreads,
  sendMessage,
} from '@/features/ai-review/api/chat.api'
import { chatKeys } from '@/features/ai-review/lib/query-keys'
import { ApiError } from '@/lib/api-client'

export type ChatSendErrorKind =
  | 'provider-unavailable'
  | 'quota-exhausted'
  | 'ai-not-enabled'
  | 'forbidden'
  | 'throttled'
  | 'too-long'
  | 'too-many-cases'
  | 'error'

export interface PendingMessage {
  content?: string
  status: 'sending' | 'unavailable' | 'error'
  errorKind?: ChatSendErrorKind
  attachedCases?: AttachedCaseRecord[]
}

function classifySendError(error: unknown): ChatSendErrorKind {
  if (error instanceof ApiError) {
    if (error.code === 'quota-exhausted') {
      return 'quota-exhausted'
    }
    if (error.code === 'provider-unavailable' || error.status === 503) {
      return 'provider-unavailable'
    }
    if (error.code === 'ai-not-enabled') {
      return 'ai-not-enabled'
    }
    if (error.code === 'too-many-cases') {
      return 'too-many-cases'
    }
    if (error.status === 403) {
      return 'forbidden'
    }
    if (error.status === 400) {
      return 'too-long'
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
  const [deleteError, setDeleteError] = useState(false)

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
    setDeleteError(false)
  }, [])

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    setPendingMessage(null)
    setDeleteError(false)
  }, [])

  const removeThread = useCallback(
    async (threadId: string) => {
      setDeleteError(false)

      try {
        await deleteThread(projectId, threadId)
      } catch {
        setDeleteError(true)
        return
      }

      if (threadId === activeThreadId) {
        setActiveThreadId(null)
        setPendingMessage(null)
      }

      queryClient.removeQueries({ queryKey: chatKeys.thread(projectId, threadId) })
      void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
    },
    [projectId, activeThreadId, queryClient],
  )

  const send = useCallback(
    async (text: string, attachedCases: AttachedCaseRecord[] = []) => {
      const content = text.trim()
      if (!content) return

      setPendingMessage({ content, status: 'sending', attachedCases })

      let threadId = activeThreadId
      const caseIds = attachedCases.map((attachedCase) => attachedCase.id)

      try {
        if (threadId === null) {
          const thread = await createThread(projectId)
          threadId = thread.id
          setActiveThreadId(threadId)
          void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
        }

        if (caseIds.length > 0) {
          await sendMessage(projectId, threadId, content, caseIds)
        } else {
          await sendMessage(projectId, threadId, content)
        }

        await queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
        void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
        setPendingMessage(null)
      } catch (error) {
        const kind = classifySendError(error)

        if ((kind === 'provider-unavailable' || kind === 'quota-exhausted') && threadId !== null) {
          await queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
          setPendingMessage({ status: 'unavailable', errorKind: kind })
          return
        }

        setPendingMessage({
          content,
          status: 'error',
          errorKind: kind,
          attachedCases,
        })
      }
    },
    [projectId, activeThreadId, queryClient],
  )

  return {
    threads: threadsQuery.data ?? [],
    isLoadingThreads: threadsQuery.isLoading,
    activeThreadId,
    messages: threadQuery.data?.messages ?? [],
    isLoadingThread: activeThreadId !== null && threadQuery.isLoading,
    pendingMessage,
    deleteError,
    startNewChat,
    selectThread,
    removeThread,
    send,
  }
}
