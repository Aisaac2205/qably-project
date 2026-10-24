'use client'

import { useState } from 'react'
import {
  AssistantRuntimeProvider,
  AuiConfig,
  SuggestionPrimitive,
  Suggestions,
  ThreadPrimitive,
} from '@assistant-ui/react'
import { ArrowDown, ArrowRight } from '@phosphor-icons/react'
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

function AerisGreeting() {
  const { t } = useTranslation()

  return (
    <div className="m-auto flex w-full max-w-xl flex-col items-center gap-6 p-6 text-center sm:p-8">
      <AerisIcon className="size-11 shrink-0 sm:size-12" />
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-balance text-default sm:text-xl">
          {t('aiReview.chatGreeting')}
        </h2>
        <p className="text-sm text-pretty text-muted">{t('aiReview.chatEmptyHint')}</p>
      </div>
      <div
        role="group"
        aria-label={t('aiReview.chatSuggestionsLabel')}
        className="w-full divide-y divide-border overflow-hidden rounded-xl border border-border text-left"
      >
        <ThreadPrimitive.Suggestions>
          {() => (
            <SuggestionPrimitive.Trigger
              send
              className="group flex w-full cursor-pointer items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <SuggestionPrimitive.Title className="text-sm font-medium text-default" />
                <SuggestionPrimitive.Description className="text-xs text-muted" />
              </span>
              <ArrowRight
                size={14}
                aria-hidden="true"
                className="shrink-0 text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              />
            </SuggestionPrimitive.Trigger>
          )}
        </ThreadPrimitive.Suggestions>
      </div>
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
  // Prompts the assistant can answer from the project data it is always given:
  // suite names with their case counts, active case titles and recent runs.
  const config = AuiConfig({
    suggestions: Suggestions([
      {
        title: t('aiReview.chatSuggestionThinSuiteTitle'),
        label: t('aiReview.chatSuggestionThinSuiteLabel'),
        prompt: t('aiReview.chatSuggestionThinSuitePrompt'),
      },
      {
        title: t('aiReview.chatSuggestionRecentRunsTitle'),
        label: t('aiReview.chatSuggestionRecentRunsLabel'),
        prompt: t('aiReview.chatSuggestionRecentRunsPrompt'),
      },
      {
        title: t('aiReview.chatSuggestionCoverageGapsTitle'),
        label: t('aiReview.chatSuggestionCoverageGapsLabel'),
        prompt: t('aiReview.chatSuggestionCoverageGapsPrompt'),
      },
    ]),
  })

  const { messages, pendingMessage, isRunning } = chat
  const isEmpty = messages.length === 0 && pendingMessage === null && !isRunning
  const lastReplyId = messages.findLast((message) => message.role === 'assistant')?.id

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
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

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto">
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
