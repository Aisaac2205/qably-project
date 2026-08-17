'use client'

import { useCallback, useState } from 'react'
import { useChatMessages, useChatThreads, useAllChatMessages } from '@/lib/use-mock-store'
import { sendChatMessage, deleteChatThread } from '@/lib/mock-store'

export function useProjectChat(projectId: string, initialThreadId: string | null = null) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId)
  const threads = useChatThreads(projectId)
  const messages = useChatMessages(activeThreadId)
  const allMessages = useAllChatMessages()

  const startNewChat = useCallback(() => {
    setActiveThreadId(null)
  }, [])

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
  }, [])

  const removeThread = useCallback(
    (threadId: string) => {
      deleteChatThread(threadId)
      if (activeThreadId === threadId) {
        setActiveThreadId(null)
      }
    },
    [activeThreadId],
  )

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return
      const result = sendChatMessage(projectId, text, activeThreadId ?? undefined)
      if (!activeThreadId) {
        setActiveThreadId(result.thread.id)
      }
      return result
    },
    [projectId, activeThreadId],
  )

  return {
    threads,
    activeThreadId,
    messages,
    allMessages,
    startNewChat,
    selectThread,
    removeThread,
    send,
  }
}
