'use client'

import { useMemo } from 'react'
import { useExternalStoreRuntime, type AppendMessage } from '@assistant-ui/react'
import type { AttachedCaseRecord, ChatMessageRecord } from '@qably/types'
import type { PendingMessage } from '@/features/projects/test-generation/hooks/use-project-chat'
import {
  buildRuntimeMessages,
  convertAerisMessage,
} from '@/features/ai-review/lib/aeris-runtime-messages'

export interface AerisChatState {
  messages: ChatMessageRecord[]
  pendingMessage: PendingMessage | null
  streamingText: string
  isRunning: boolean
  send: (text: string, attachedCases?: AttachedCaseRecord[], filePath?: string) => Promise<void>
  cancel: () => void
}

function textOf(message: AppendMessage): string {
  return message.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim()
}

/**
 * Bridges useProjectChat to assistant-ui as an external store: the hook stays
 * the source of truth for threads, sending and cancelling, while assistant-ui
 * renders the thread and owns the composer text. The attached cases and file
 * path live next to the composer and travel with each new message.
 */
export function useAerisRuntime({
  chat,
  attachedCases,
  attachedFilePath,
  onAttachmentsSent,
}: {
  chat: AerisChatState
  attachedCases: AttachedCaseRecord[]
  attachedFilePath: string | null
  onAttachmentsSent: () => void
}) {
  const { messages, pendingMessage, streamingText, isRunning, send, cancel } = chat

  const runtimeMessages = useMemo(
    () => buildRuntimeMessages({ messages, pendingMessage, streamingText, isRunning }),
    [messages, pendingMessage, streamingText, isRunning],
  )

  return useExternalStoreRuntime({
    messages: runtimeMessages,
    convertMessage: convertAerisMessage,
    isRunning,
    onNew: async (message) => {
      const text = textOf(message)
      if (text === '') return

      void send(text, attachedCases, attachedFilePath ?? undefined)
      onAttachmentsSent()
    },
    onCancel: async () => {
      cancel()
    },
  })
}
