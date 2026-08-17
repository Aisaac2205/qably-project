'use client'

import type { ChatMessage } from '@qably/types'
import { Sparkle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { ChatGeneratedCaseCard } from './chat-generated-case-card'

export function ChatMessageBubble({
  message,
  onViewCase,
}: {
  message: ChatMessage
  onViewCase: (caseId: string) => void
}) {
  const { t } = useTranslation()
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
              <Sparkle size={13} weight="fill" className="text-primary" aria-hidden="true" />
              <span>{t('aiReview.aiAssistant')}</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.generatedCaseIds?.map((caseId) => (
          <div key={caseId} className="w-full">
            <ChatGeneratedCaseCard caseId={caseId} onView={onViewCase} />
          </div>
        ))}
      </div>
    </div>
  )
}
