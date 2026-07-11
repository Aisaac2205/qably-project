'use client'

import type { ChatMessage } from '@qably/types'
import { ChatGeneratedCaseCard } from './chat-generated-case-card'

export function ChatMessageBubble({
  message,
  projectId,
  onViewCase,
}: {
  message: ChatMessage
  projectId: string
  onViewCase: (caseId: string) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
            isUser ? 'bg-primary text-primary-fg' : 'bg-surface border border-border text-default'
          }`}
        >
          {message.content}
        </div>
        {message.generatedCaseIds?.map((caseId) => (
          <ChatGeneratedCaseCard key={caseId} caseId={caseId} projectId={projectId} onView={onViewCase} />
        ))}
      </div>
    </div>
  )
}
