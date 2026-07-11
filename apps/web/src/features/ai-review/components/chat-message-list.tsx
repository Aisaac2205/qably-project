'use client'

import type { ChatMessage } from '@qably/types'
import { ChatMessageBubble } from './chat-message-bubble'
import { ChatCircleDots } from '@phosphor-icons/react'

export function ChatMessageList({
  messages,
  projectId,
  onViewCase,
}: {
  messages: ChatMessage[]
  projectId: string
  onViewCase: (caseId: string) => void
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted gap-2 p-4">
        <ChatCircleDots size={28} weight="light" aria-hidden="true" />
        <p className="text-xs">Ask anything about this project&apos;s suites, cases, or coverage.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} projectId={projectId} onViewCase={onViewCase} />
      ))}
    </div>
  )
}
