'use client'

import { Info } from '@phosphor-icons/react'
import { ASSISTANT_MODEL_NAME, type AttachedCaseRecord, type ChatMessageRecord } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { useTranslation } from '@/lib/i18n'
import { ChatGeneratedCaseCard } from './chat-generated-case-card'
import { ChatCaseChip } from './chat-case-chip'

export function ChatMessageBubble({
  projectId,
  message,
  attachedCasesForProposals,
}: {
  projectId: string
  message: ChatMessageRecord
  attachedCasesForProposals?: AttachedCaseRecord[]
}) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const attachedCases = message.attachedCases ?? []
  const isDeclined = !isUser && message.grounding?.status === 'insufficient'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col space-y-2`}>
        {isUser && attachedCases.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {attachedCases.map((attachedCase) => (
              <ChatCaseChip key={attachedCase.id} attachedCase={attachedCase} />
            ))}
          </div>
        )}
        <div
          className={`text-xs sm:text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-fg rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs'
              : 'bg-surface border border-border text-default rounded-2xl rounded-tl-xs p-4 shadow-xs'
          }`}
        >
          {!isUser && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted mb-2">
              <AerisIcon size={14} />
              <span>{ASSISTANT_MODEL_NAME}</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {isDeclined && (
          <p className="inline-flex items-center gap-1 self-start rounded-full border border-border/60 bg-canvas/50 px-2 py-0.5 text-[10px] font-medium text-muted">
            <Info size={11} aria-hidden="true" />
            {t('aiReview.chatGroundingInsufficient')}
          </p>
        )}
        {message.suggestedCases.map((suggestedCase, index) => (
          <div key={index} className="w-full">
            <ChatGeneratedCaseCard
              projectId={projectId}
              threadId={message.threadId}
              messageId={message.id}
              caseIndex={index}
              suggestedCase={suggestedCase}
              sentProposalId={message.sentProposalIds?.[index]}
              attachedCases={attachedCasesForProposals}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
