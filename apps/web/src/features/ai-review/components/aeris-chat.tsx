'use client'

import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { AssistantRuntimeProvider, ThreadPrimitive } from '@assistant-ui/react'
import { ArrowDown } from '@phosphor-icons/react'
import type { AttachedCaseRecord } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PendingMessage } from '@/features/projects/test-generation/hooks/use-project-chat'
import { useAerisRuntime, type AerisChatState } from '../hooks/use-aeris-runtime'
import { AerisAssistantMessage, AerisUserMessage } from './aeris-messages'
import { AerisComposer } from './aeris-composer'

type Translate = (key: string) => string

function pendingErrorCopy(errorKind: PendingMessage['errorKind'], t: Translate): string {
  switch (errorKind) {
    case 'ai-not-enabled':
      return t('aiReview.chatAiNotEnabled')
    case 'forbidden':
      return t('aiReview.chatForbidden')
    case 'too-long':
      return t('aiReview.chatMessageTooLong')
    case 'too-many-cases':
      return t('aiReview.chatTooManyCases')
    case 'file-unreadable':
      return t('aiReview.chatFileUnreadable')
    case 'throttled':
      return t('aiReview.chatThrottled')
    default:
      return t('aiReview.chatSendError')
  }
}

const noticeClass =
  'max-w-3/4 self-start rounded-xl border px-4 py-2.5 text-sm'

function PendingNotice({ pendingMessage }: { pendingMessage: PendingMessage | null }) {
  const { t } = useTranslation()

  if (pendingMessage?.status === 'unavailable') {
    return (
      <p role="status" className={cn(noticeClass, 'border-border bg-surface text-muted')}>
        {pendingMessage.errorKind === 'quota-exhausted'
          ? t('aiReview.chatQuotaExhausted')
          : t('aiReview.assistantUnavailable')}
      </p>
    )
  }

  if (pendingMessage?.status === 'error') {
    return (
      <p role="alert" className={cn(noticeClass, 'border-fail/30 bg-fail-bg text-fail')}>
        {pendingErrorCopy(pendingMessage.errorKind, t)}
      </p>
    )
  }

  return null
}

// Matches the composer's travel: quick, and settling instead of stopping.
const COMPOSER_MOVE = { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }

function AerisGreeting() {
  const { t } = useTranslation()
  const words = t('aiReview.chatGreeting').split(' ')

  // Pushed down by mt-auto so that, with the composer's mb-auto, the pair sits
  // in the middle of an empty chat. The words rise in one after another.
  return (
    <div className="mt-auto flex w-full flex-col items-center gap-4 px-4 pb-5 text-center sm:gap-5 sm:pb-6">
      <AerisIcon className="size-9 animate-page-enter sm:size-10" />
      <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance text-default sm:text-3xl">
        {words.map((word, index) => (
          <Fragment key={index}>
            {index > 0 && ' '}
            <span className="inline-block animate-page-enter" style={{ animationDelay: `${60 + index * 40}ms` }}>
              {word}
            </span>
          </Fragment>
        ))}
      </h2>
    </div>
  )
}

export function AerisChat({
  projectId,
  chat,
  isLoadingThread,
  deleteError,
  initialAttachedCase,
}: {
  projectId: string
  chat: AerisChatState
  isLoadingThread: boolean
  deleteError: boolean
  initialAttachedCase?: AttachedCaseRecord
}) {
  const { t } = useTranslation()
  const [attachedCases, setAttachedCases] = useState<AttachedCaseRecord[]>(() =>
    initialAttachedCase ? [initialAttachedCase] : [],
  )
  const [attachedFilePath, setAttachedFilePath] = useState<string | null>(null)
  const runtime = useAerisRuntime({
    chat,
    attachedCases,
    attachedFilePath,
    onAttachmentsSent: () => {
      setAttachedCases([])
      setAttachedFilePath(null)
    },
  })
  const { messages, pendingMessage, isRunning } = chat
  const isEmpty = messages.length === 0 && pendingMessage === null && !isRunning
  const isCentered = isEmpty && !isLoadingThread
  const lastReplyId = messages.findLast((message) => message.role === 'assistant')?.id
  const footerRef = useRef<HTMLDivElement>(null)
  const footerTopRef = useRef<number | null>(null)

  // The composer starts in the middle of an empty chat and drops to the bottom
  // once the first message lands, or rises back on a new chat. Slide it from
  // where it was so the eye follows the bar instead of losing it.
  useLayoutEffect(() => {
    const footer = footerRef.current
    if (!footer) return
    const top = footer.getBoundingClientRect().top
    const previousTop = footerTopRef.current
    footerTopRef.current = top
    if (previousTop === null || Math.abs(previousTop - top) < 1) return
    if (typeof footer.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    footer.animate(
      [{ transform: `translateY(${previousTop - top}px)` }, { transform: 'translateY(0)' }],
      COMPOSER_MOVE,
    )
  }, [isCentered])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col bg-surface">
        <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isEmpty && isLoadingThread ? (
            <StateView kind="loading" title={t('aiReview.chatLoadingThread')} className="m-auto" />
          ) : isEmpty ? (
            <AerisGreeting />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
              <ThreadPrimitive.Messages>
                {({ message }) =>
                  message.role === 'user' ? (
                    <AerisUserMessage />
                  ) : (
                    <AerisAssistantMessage projectId={projectId} />
                  )
                }
              </ThreadPrimitive.Messages>
              <PendingNotice pendingMessage={pendingMessage} />
            </div>
          )}

          {/* Announces a finished reply once instead of every streamed token. */}
          <div aria-live="polite" className="sr-only">
            {lastReplyId !== undefined && <span key={lastReplyId}>{t('aiReview.newAssistantReply')}</span>}
          </div>

          <ThreadPrimitive.ViewportFooter
            ref={footerRef}
            className={cn(isCentered ? 'mb-auto pb-16 sm:pb-24' : 'sticky bottom-0 mt-auto')}
          >
            <ThreadPrimitive.ScrollToBottom
              aria-label={t('aiReview.chatScrollToLatest')}
              title={t('aiReview.chatScrollToLatest')}
              className="absolute -top-12 left-1/2 inline-flex size-9 -translate-x-1/2 animate-in cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-muted shadow-pop transition-colors fade-in-0 hover:text-default focus-visible:outline-2 focus-visible:outline-primary disabled:hidden"
            >
              <ArrowDown size={16} aria-hidden="true" />
            </ThreadPrimitive.ScrollToBottom>

            {deleteError && (
              <p
                role="alert"
                className="mx-3 mb-2 rounded-lg border border-fail/30 bg-fail-bg px-3 py-2 text-xs text-fail sm:mx-auto sm:max-w-3xl"
              >
                {t('aiReview.deleteChatError')}
              </p>
            )}

            <AerisComposer
              projectId={projectId}
              attachedCases={attachedCases}
              onAttachedCasesChange={setAttachedCases}
              attachedFilePath={attachedFilePath}
              onAttachedFilePathChange={setAttachedFilePath}
            />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
