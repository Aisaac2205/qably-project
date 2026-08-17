'use client'

import Image from 'next/image'
import type { ChatMessage } from '@qably/types'
import { ChatMessageBubble } from './chat-message-bubble'
import { ListChecks, Flask, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ChatMessageList({
  messages,
  onViewCase,
  onSelectSuggestion,
}: {
  messages: ChatMessage[]
  onViewCase: (caseId: string) => void
  onSelectSuggestion?: (prompt: string) => void
}) {
  const { t } = useTranslation()

  if (messages.length === 0) {
    const starters = [
      {
        icon: ListChecks,
        text: t('aiReview.promptStarter1'),
      },
      {
        icon: Flask,
        text: t('aiReview.promptStarter2'),
      },
      {
        icon: ShieldCheck,
        text: t('aiReview.promptStarter3'),
      },
    ]

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center p-6 sm:p-8 gap-6 select-none max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/icono-qably.png"
            alt="Qably"
            width={48}
            height={48}
            className="size-12 object-contain dark:invert"
            priority
          />
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
    <div className="flex flex-col p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full">
      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          onViewCase={onViewCase}
        />
      ))}
    </div>
  )
}
