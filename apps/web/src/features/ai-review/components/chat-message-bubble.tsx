'use client'

import { ASSISTANT_MODEL_NAME, type ChatMessageRecord } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { ChatGeneratedCaseCard } from './chat-generated-case-card'

export function ChatMessageBubble({
  projectId,
  message,
}: {
  projectId: string
  message: ChatMessageRecord
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col space-y-2`}>
        <div
          className={`text-xs sm:text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-fg rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs'
              : 'bg-surface border border-border text-default rounded-2xl rounded-tl-xs p-4 shadow-xs'
          }`}
        >
          {!isUser && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted mb-2">
              <AerisIcon size={13} className="text-primary" />
              <span>{ASSISTANT_MODEL_NAME}</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.suggestedCases.map((suggestedCase, index) => (
          <div key={index} className="w-full">
            <ChatGeneratedCaseCard
              projectId={projectId}
              threadId={message.threadId}
              messageId={message.id}
              caseIndex={index}
              suggestedCase={suggestedCase}
              sentProposalId={message.sentProposalIds?.[index]}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
