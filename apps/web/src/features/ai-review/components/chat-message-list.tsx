'use client'

import type { ChatMessageRecord } from '@qably/types'
import { ChatMessageBubble } from './chat-message-bubble'
import { ChatCaseChip } from './chat-case-chip'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { useTranslation } from '@/lib/i18n'
import { StateView } from '@/components/ui/state-view'
import type { PendingMessage } from '@/features/projects/test-generation/hooks/use-project-chat'

function pendingErrorCopy(
  errorKind: PendingMessage['errorKind'],
  t: (key: string) => string,
): string {
  switch (errorKind) {
    case 'ai-not-enabled':
      return t('aiReview.chatAiNotEnabled')
    case 'forbidden':
      return t('aiReview.chatForbidden')
    case 'too-long':
      return t('aiReview.chatMessageTooLong')
    case 'too-many-cases':
      return t('aiReview.chatTooManyCases')
    case 'throttled':
      return t('aiReview.chatThrottled')
    default:
      return t('aiReview.chatSendError')
  }
}

export function ChatMessageList({
  projectId,
  messages,
  pendingMessage,
  isLoadingThread = false,
}: {
  projectId: string
  messages: ChatMessageRecord[]
  pendingMessage?: PendingMessage | null
  isLoadingThread?: boolean
}) {
  const { t } = useTranslation()

  if (messages.length === 0 && !pendingMessage && isLoadingThread) {
    return <StateView kind="loading" title={t('aiReview.chatLoadingThread')} className="h-full min-h-[380px]" />
  }

  if (messages.length === 0 && !pendingMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center p-6 sm:p-8 gap-3 select-none max-w-2xl mx-auto">
        <AerisIcon className="size-11 sm:size-12 shrink-0" />
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-lg sm:text-xl font-semibold text-default tracking-tight">
            {t('aiReview.chatGreeting')}
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            {t('aiReview.chatEmptyHint')}
          </p>
        </div>
      </div>
    )
  }

  const lastAssistantMessage = messages.findLast((message) => message.role === 'assistant')

  return (
    <div className="flex flex-col p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full">
      <div key={lastAssistantMessage?.id ?? 'none'} aria-live="polite" className="sr-only">
        {lastAssistantMessage ? t('aiReview.newAssistantReply') : ''}
      </div>

      {messages.map((message, index) => {
        const precedingUserMessage: ChatMessageRecord | undefined =
          message.role === 'assistant'
            ? messages.slice(0, index).findLast((candidate) => candidate.role === 'user')
            : undefined

        return (
          <ChatMessageBubble
            key={message.id}
            projectId={projectId}
            message={message}
            attachedCasesForProposals={precedingUserMessage?.attachedCases}
          />
        )
      })}

      {pendingMessage && (
        <div className="flex flex-col space-y-2">
          {pendingMessage.attachedCases && pendingMessage.attachedCases.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {pendingMessage.attachedCases.map((attachedCase) => (
                <ChatCaseChip key={attachedCase.id} attachedCase={attachedCase} />
              ))}
            </div>
          )}

          {pendingMessage.content && (
            <div className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[80%] bg-primary text-primary-fg rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs text-xs sm:text-sm">
                {pendingMessage.content}
              </div>
            </div>
          )}

          {pendingMessage.status === 'sending' && (
            <div className="flex justify-start">
              <p role="status" className="text-xs text-muted italic px-2">
                {t('aiReview.assistantThinking')}
              </p>
            </div>
          )}

          {pendingMessage.status === 'unavailable' && (
            <div className="flex justify-start">
              <p
                role="status"
                className="max-w-[85%] sm:max-w-[80%] text-xs sm:text-sm text-muted bg-surface border border-border rounded-2xl rounded-tl-xs px-4 py-2.5"
              >
                {t('aiReview.assistantUnavailable')}
              </p>
            </div>
          )}

          {pendingMessage.status === 'error' && (
            <div className="flex justify-start">
              <p
                role="alert"
                className="max-w-[85%] sm:max-w-[80%] text-xs sm:text-sm text-fail bg-fail-bg border border-fail/30 rounded-2xl rounded-tl-xs px-4 py-2.5"
              >
                {pendingErrorCopy(pendingMessage.errorKind, t)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
