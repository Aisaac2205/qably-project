'use client'

import { useCallback, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AttachedCaseRecord,
  ChatMessageRecord,
  ChatThreadDetailRecord,
  ChatThreadRecord,
  SuggestedCaseRecord,
} from '@qably/types'
import {
  createThread,
  deleteThread,
  getThread,
  listThreads,
  streamMessage,
} from '@/features/ai-review/api/chat.api'
import {
  ChatStreamError,
  isAbortError,
  type ChatStreamDone,
} from '@/features/ai-review/lib/chat-stream'
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
  | 'file-unreadable'
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
    if (error.code === 'file-unreadable') {
      return 'file-unreadable'
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

function appendReply(
  detail: ChatThreadDetailRecord | undefined,
  { userMessage, assistantMessage }: ChatStreamDone,
): ChatThreadDetailRecord | undefined {
  if (detail === undefined) return undefined

  const replyIds = new Set([userMessage.id, assistantMessage.id])

  return {
    ...detail,
    messages: [
      ...detail.messages.filter((message) => !replyIds.has(message.id)),
      userMessage,
      assistantMessage,
    ],
  }
}

interface ChatRun {
  controller: AbortController
}

export function useProjectChat(projectId: string) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null)
  const [deleteError, setDeleteError] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingCases, setStreamingCases] = useState<SuggestedCaseRecord[]>([])
  const [isRunning, setIsRunning] = useState(false)
  // While a reply is in flight the visible thread is the snapshot taken when it
  // was sent: the server stores the question first, so a refetch mid-stream
  // would otherwise show it twice next to the optimistic bubble.
  const [frozenMessages, setFrozenMessages] = useState<ChatMessageRecord[] | null>(null)
  const runRef = useRef<ChatRun | null>(null)

  const threadsQuery = useQuery({
    queryKey: chatKeys.threads(projectId),
    queryFn: ({ signal }) => listThreads(projectId, signal),
  })

  const threadQuery = useQuery({
    queryKey: chatKeys.thread(projectId, activeThreadId ?? ''),
    queryFn: ({ signal }) => getThread(projectId, activeThreadId as string, signal),
    enabled: activeThreadId !== null,
  })

  const settleRun = useCallback((pending: PendingMessage | null) => {
    runRef.current = null
    setPendingMessage(pending)
    setStreamingText('')
    setStreamingCases([])
    setIsRunning(false)
    setFrozenMessages(null)
  }, [])

  const startNewChat = useCallback(() => {
    settleRun(null)
    setActiveThreadId(null)
    setDeleteError(false)
  }, [settleRun])

  const selectThread = useCallback(
    (threadId: string) => {
      settleRun(null)
      setActiveThreadId(threadId)
      setDeleteError(false)
    },
    [settleRun],
  )

  const cancel = useCallback(() => {
    runRef.current?.controller.abort()
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
        runRef.current?.controller.abort()
        settleRun(null)
        setActiveThreadId(null)
      }

      queryClient.removeQueries({ queryKey: chatKeys.thread(projectId, threadId) })
      void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
    },
    [projectId, activeThreadId, queryClient, settleRun],
  )

  const send = useCallback(
    async (text: string, attachedCases: AttachedCaseRecord[] = [], filePath?: string) => {
      const content = text.trim()
      if (!content) return

      const run: ChatRun = { controller: new AbortController() }
      runRef.current = run
      // Opening another conversation detaches the run: the reply still lands in
      // its own thread cache, but it no longer drives what the panel shows.
      const isCurrent = () => runRef.current === run

      let threadId = activeThreadId
      let createdThread: ChatThreadRecord | undefined
      const caseIds = attachedCases.map((attachedCase) => attachedCase.id)

      setFrozenMessages(
        threadId === null
          ? []
          : (queryClient.getQueryData<ChatThreadDetailRecord>(chatKeys.thread(projectId, threadId))
              ?.messages ?? []),
      )
      setPendingMessage({ content, status: 'sending', attachedCases })
      setStreamingText('')
      setStreamingCases([])
      setIsRunning(true)

      try {
        if (threadId === null) {
          createdThread = await createThread(projectId)
          threadId = createdThread.id
          if (isCurrent()) setActiveThreadId(threadId)
          void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
        }

        if (run.controller.signal.aborted) {
          throw new DOMException('The chat reply was stopped', 'AbortError')
        }

        const reply = await streamMessage(
          projectId,
          threadId,
          { content, caseIds, filePath },
          {
            signal: run.controller.signal,
            onDelta: (delta) => {
              if (isCurrent()) setStreamingText((previous) => previous + delta)
            },
            onCase: (index, suggestedCase) => {
              if (!isCurrent()) return
              setStreamingCases((previous) => {
                const next = [...previous]
                next[index] = suggestedCase
                return next
              })
            },
          },
        )

        const threadKey = chatKeys.thread(projectId, threadId)
        const placeholder = createdThread && { ...createdThread, messages: [] }
        await queryClient.cancelQueries({ queryKey: threadKey })
        queryClient.setQueryData<ChatThreadDetailRecord>(threadKey, (detail) =>
          appendReply(detail ?? placeholder, reply),
        )
        if (isCurrent()) settleRun(null)

        void queryClient.invalidateQueries({ queryKey: threadKey })
        void queryClient.invalidateQueries({ queryKey: chatKeys.threads(projectId) })
      } catch (error) {
        if (!isCurrent()) return

        setStreamingText('')
        setStreamingCases([])
        setIsRunning(false)

        const refetchThread = async () => {
          if (threadId !== null) {
            await queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
          }
        }

        if (isAbortError(error)) {
          // The server keeps the question and drops the partial reply.
          await refetchThread()
          if (isCurrent()) settleRun(null)
          return
        }

        const kind = classifySendError(error)

        if ((kind === 'provider-unavailable' || kind === 'quota-exhausted') && threadId !== null) {
          await refetchThread()
          if (isCurrent()) settleRun({ status: 'unavailable', errorKind: kind })
          return
        }

        if (error instanceof ChatStreamError && threadId !== null) {
          await refetchThread()
          if (isCurrent()) settleRun({ status: 'error', errorKind: kind })
          return
        }

        settleRun({ content, status: 'error', errorKind: kind, attachedCases })
      }
    },
    [projectId, activeThreadId, queryClient, settleRun],
  )

  return {
    threads: threadsQuery.data ?? [],
    isLoadingThread: activeThreadId !== null && frozenMessages === null && threadQuery.isLoading,
    activeThreadId,
    messages: frozenMessages ?? threadQuery.data?.messages ?? [],
    pendingMessage,
    streamingText,
    streamingCases,
    isRunning,
    deleteError,
    startNewChat,
    selectThread,
    removeThread,
    send,
    cancel,
  }
}
