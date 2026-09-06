'use client'

import type { ChatMessageRecord } from '@qably/types'
import { ChatMessageBubble } from './chat-message-bubble'
import { ListChecks, Flask, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import type { PendingMessage } from '@/features/projects/test-generation/hooks/use-project-chat'

function QablyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <rect x="0" y="0" width="28" height="28" rx="5" />
      <rect x="36" y="0" width="28" height="28" rx="5" />
      <rect x="72" y="0" width="28" height="28" rx="5" />
      <rect x="36" y="36" width="28" height="28" rx="5" />
      <rect x="72" y="36" width="28" height="28" rx="5" />
      <rect x="72" y="72" width="28" height="28" rx="5" />
    </svg>
  )
}

function pendingErrorCopy(
  errorKind: PendingMessage['errorKind'],
  t: (key: string) => string,
): string {
  switch (errorKind) {
    case 'ai-not-enabled':
      return t('aiReview.chatAiNotEnabled')
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
  onSelectSuggestion,
}: {
  projectId: string
  messages: ChatMessageRecord[]
  pendingMessage?: PendingMessage | null
  onSelectSuggestion?: (prompt: string) => void
}) {
  const { t } = useTranslation()

  if (messages.length === 0 && !pendingMessage) {
    const starters = [
      { icon: ListChecks, text: t('aiReview.promptStarter1') },
      { icon: Flask, text: t('aiReview.promptStarter2') },
      { icon: ShieldCheck, text: t('aiReview.promptStarter3') },
    ]

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center p-6 sm:p-8 gap-6 select-none max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3">
          <QablyIcon className="size-11 sm:size-12 text-default shrink-0" />
          <div className="space-y-1.5 max-w-md">
            <h2 className="text-lg sm:text-xl font-semibold text-default tracking-tight">
              {t('aiReview.chatGreeting')}
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {t('aiReview.chatEmptyHint')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full pt-2">
          {starters.map((starter, i) => {
            const Icon = starter.icon
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectSuggestion?.(starter.text)}
                className="group flex flex-col items-start text-left p-3.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-hover/80 hover:border-border transition-all duration-150 active:scale-[0.98] shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="size-7 rounded-lg bg-canvas text-muted group-hover:text-primary group-hover:bg-primary/10 flex items-center justify-center transition-colors mb-2">
                  <Icon size={16} weight="regular" aria-hidden="true" />
                </div>
                <p className="text-xs font-medium text-default leading-snug line-clamp-3">
                  {starter.text}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} projectId={projectId} message={message} />
      ))}

      {pendingMessage && (
        <div className="flex flex-col space-y-2">
          <div className="flex justify-end">
            <div className="max-w-[85%] sm:max-w-[80%] bg-primary text-primary-fg rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs text-xs sm:text-sm">
              {pendingMessage.content}
            </div>
          </div>

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
