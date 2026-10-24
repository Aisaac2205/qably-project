'use client'

import { ActionBarPrimitive, AuiIf, MessagePrimitive, useAuiState } from '@assistant-ui/react'
import { Check, Copy, Info } from '@phosphor-icons/react'
import type { AttachedCaseRecord } from '@qably/types'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  ATTACHED_CASES_PART,
  SUGGESTED_CASES_PART,
  type AerisMessageCustomMetadata,
  type SuggestedCasesPartData,
} from '../lib/aeris-runtime-messages'
import { AerisMarkdownText } from './aeris-markdown-text'
import { ChatCaseChip } from './chat-case-chip'
import { ChatGeneratedCaseCard } from './chat-generated-case-card'

const hideDataParts = { Fallback: () => null }

function UserText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

export function AerisUserMessage() {
  const { t } = useTranslation()
  const attachedCasesPart = useAuiState((state) =>
    state.message.parts.find((part) => part.type === 'data' && part.name === ATTACHED_CASES_PART),
  )
  const attachedCases =
    attachedCasesPart?.type === 'data' ? (attachedCasesPart.data as AttachedCaseRecord[]) : []

  return (
    <MessagePrimitive.Root data-author="user" className="flex flex-col items-end gap-2">
      <p className="sr-only">{t('aiReview.chatUserAuthor')}</p>
      {attachedCases.length > 0 && (
        <div className="flex max-w-3/4 flex-wrap justify-end gap-1.5">
          {attachedCases.map((attachedCase) => (
            <ChatCaseChip key={attachedCase.id} attachedCase={attachedCase} />
          ))}
        </div>
      )}
      {/* A 24px radius on a one-line bubble (about 40px tall) clamps to a full
          pill; longer questions keep the same soft corners. */}
      <div className="max-w-3/4 rounded-3xl bg-canvas px-4 py-2.5 text-sm text-default">
        <MessagePrimitive.Parts components={{ Text: UserText, data: hideDataParts }} />
      </div>
    </MessagePrimitive.Root>
  )
}

function ThinkingIndicator() {
  const { t } = useTranslation()

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <Spinner size="sm" />
      <span>{t('aiReview.assistantThinking')}</span>
    </p>
  )
}

function CopyReplyAction({ isLast }: { isLast: boolean }) {
  const { t } = useTranslation()
  const isCopied = useAuiState((state) => state.message.isCopied)
  const label = isCopied ? t('aiReview.chatReplyCopied') : t('aiReview.chatCopyReply')

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="never"
      className={cn(
        // Pulls the icon onto the reply's text edge; the hit area stays 32px.
        '-ms-2 flex items-center',
        // Older replies reveal the action on hover or keyboard focus; touch
        // screens, which cannot hover, always show it.
        !isLast &&
          'transition-opacity duration-150 ease-out pointer-fine:opacity-0 pointer-fine:group-hover/message:opacity-100 pointer-fine:focus-within:opacity-100',
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={<ActionBarPrimitive.Copy aria-label={label} />}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-default focus-visible:outline-2 focus-visible:outline-primary md:size-7"
        >
          <AuiIf condition={(state) => state.message.isCopied}>
            <Check size={15} weight="bold" aria-hidden="true" className="text-pass" />
          </AuiIf>
          <AuiIf condition={(state) => !state.message.isCopied}>
            <Copy size={15} aria-hidden="true" />
          </AuiIf>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </ActionBarPrimitive.Root>
  )
}

export function AerisAssistantMessage({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const isRunning = useAuiState((state) => state.message.status?.type === 'running')
  const hasText = useAuiState((state) => state.message.parts.some((part) => part.type === 'text'))
  const isLast = useAuiState((state) => state.message.isLast)
  const custom = useAuiState(
    (state) => state.message.metadata.custom as Partial<AerisMessageCustomMetadata> | undefined,
  )
  const suggestedCasesPart = useAuiState((state) =>
    state.message.parts.find((part) => part.type === 'data' && part.name === SUGGESTED_CASES_PART),
  )
  const suggestedCases =
    suggestedCasesPart?.type === 'data' ? (suggestedCasesPart.data as SuggestedCasesPartData) : null
  const isDeclined = custom?.grounding?.status === 'insufficient'

  return (
    <MessagePrimitive.Root
      data-author="assistant"
      aria-busy={isRunning || undefined}
      className="group/message flex flex-col items-start gap-2"
    >
      {/* The reply sits on the page itself; this label keeps its author known
          to a screen reader now that no visible header names it. */}
      <p className="sr-only">{t('aiReview.chatAssistantAuthor')}</p>
      <div className="w-full min-w-0 text-sm leading-relaxed text-default">
        <MessagePrimitive.Parts components={{ Text: AerisMarkdownText, data: hideDataParts }} />
        {isRunning && !hasText && <ThinkingIndicator />}
      </div>

      {isDeclined && (
        <p className="inline-flex items-center gap-1 rounded-full border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
          <Info size={12} aria-hidden="true" />
          {t('aiReview.chatGroundingInsufficient')}
        </p>
      )}

      {suggestedCases !== null && (
        <div className="flex w-full max-w-xl flex-col gap-2">
          {suggestedCases.suggestedCases.map((suggestedCase, index) => (
            <ChatGeneratedCaseCard
              key={index}
              projectId={projectId}
              threadId={suggestedCases.threadId}
              messageId={suggestedCases.messageId}
              caseIndex={index}
              suggestedCase={suggestedCase}
              sentProposalId={suggestedCases.sentProposalIds?.[index]}
              attachedCases={suggestedCases.attachedCases}
            />
          ))}
        </div>
      )}

      <CopyReplyAction isLast={isLast} />
    </MessagePrimitive.Root>
  )
}
