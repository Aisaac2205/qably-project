'use client'

import { useCallback } from 'react'
import { useChatMessages } from '@/lib/use-mock-store'
import { sendChatMessage } from '@/lib/mock-store'

export function useProjectChat(projectId: string) {
  const messages = useChatMessages(projectId)

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return
      sendChatMessage(projectId, text)
    },
    [projectId],
  )

  return { messages, send }
}
