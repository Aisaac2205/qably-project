'use client'

import { ActionBarPrimitive, AuiIf, MessagePrimitive, useAuiState } from '@assistant-ui/react'
import { Check, Copy, Info } from '@phosphor-icons/react'
import { ASSISTANT_MODEL_NAME, type AttachedCaseRecord } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
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
  const attachedCasesPart = useAuiState((state) =>
    state.message.parts.find((part) => part.type === 'data' && part.name === ATTACHED_CASES_PART),
  )
  const attachedCases =
    attachedCasesPart?.type === 'data' ? (attachedCasesPart.data as AttachedCaseRecord[]) : []

  return (
    <MessagePrimitive.Root className="flex flex-col items-end gap-2">
      {attachedCases.length > 0 && (
        <div className="flex max-w-5/6 flex-wrap justify-end gap-1.5 sm:max-w-4/5">
          {attachedCases.map((attachedCase) => (
            <ChatCaseChip key={attachedCase.id} attachedCase={attachedCase} />
          ))}
        </div>
      )}
      <div className="max-w-5/6 rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm text-primary-fg sm:max-w-4/5">
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
        'flex items-center',
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
      aria-busy={isRunning || undefined}
      className="group/message flex flex-col items-start gap-2"
    >
      <div className="max-w-5/6 rounded-2xl rounded-tl-xs border border-border bg-surface p-4 text-sm text-default sm:max-w-4/5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <AerisIcon size={14} />
          <span>{ASSISTANT_MODEL_NAME}</span>
        </p>
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
        <div className="flex w-full max-w-5/6 flex-col gap-2 sm:max-w-4/5">
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
