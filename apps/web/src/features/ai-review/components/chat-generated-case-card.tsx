'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import type { AttachedCaseRecord, SuggestedCaseRecord } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { sendToReview } from '../api/chat.api'
import { chatKeys } from '../lib/query-keys'
import { reviewInboxPath } from '@/features/projects/lib/routes'
import { ApiError } from '@/lib/api-client'

type SendState = 'idle' | 'pending' | 'error'
type SendErrorKind = 'human-documented' | 'error'

export function ChatGeneratedCaseCard({
  projectId,
  threadId,
  messageId,
  caseIndex,
  suggestedCase,
  sentProposalId,
  attachedCases,
}: {
  projectId: string
  threadId: string
  messageId: string
  caseIndex: number
  suggestedCase: SuggestedCaseRecord
  sentProposalId?: string
  attachedCases?: AttachedCaseRecord[]
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SendState>('idle')
  const [errorKind, setErrorKind] = useState<SendErrorKind>('error')
  const [localProposalId, setLocalProposalId] = useState<string | null>(null)

  const proposalId = sentProposalId ?? localProposalId ?? undefined
  const isSent = proposalId !== undefined
  const targetCase = attachedCases?.find(
    (attachedCase) => attachedCase.id === suggestedCase.targetTestCaseId,
  )

  async function handleSend() {
    setState('pending')
    try {
      const result = await sendToReview(projectId, threadId, messageId, caseIndex)
      setLocalProposalId(result.proposalId)
      void queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
    } catch (error) {
      setErrorKind(
        error instanceof ApiError && error.code === 'human-documented'
          ? 'human-documented'
          : 'error',
      )
      setState('error')
    }
  }

  return (
    <div className="rounded-lg border border-ai/30 bg-ai-bg p-3 mt-2 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ai">
        <AerisIcon size={14} />
        {isSent ? t('aiReview.chatProposalSent') : t('aiReview.chatProposalReady')}
      </div>

      <p className="text-sm font-medium text-default">{suggestedCase.title}</p>

      {targetCase && (
        <p className="text-xs text-muted">
          {t('aiReview.chatUpdatesCase', { name: targetCase.name })}
        </p>
      )}

      {suggestedCase.targetTestCaseId !== undefined && (
        <div className="space-y-1.5 rounded-md border border-ai/20 bg-surface/60 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {t('aiReview.chatWhatAerisProposes')}
          </p>
          <dl className="space-y-1 text-xs text-default">
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-semibold text-muted">{t('aiReview.chatCaseTitle')}</dt>
              <dd className="truncate">{suggestedCase.title}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-semibold text-muted">{t('aiReview.objective')}</dt>
              <dd className="truncate">{suggestedCase.objective}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-semibold text-muted">{t('aiReview.steps')}</dt>
              <dd>{t('suites.stepsCount', { count: suggestedCase.steps.length })}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-semibold text-muted">{t('aiReview.expectedResult')}</dt>
              <dd className="truncate">{suggestedCase.expectedResult}</dd>
            </div>
          </dl>
        </div>
      )}

      {isSent ? (
        <Link
          href={reviewInboxPath(projectId)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-ai underline underline-offset-2"
        >
          {t('aiReview.viewInReviewQueue')}
        </Link>
      ) : (
        <Button size="sm" variant="outline" onClick={handleSend} disabled={state === 'pending'}>
          {state === 'pending' ? t('aiReview.sendingToReview') : t('aiReview.sendToReview')}
        </Button>
      )}

      {state === 'error' && (
        <p role="alert" className="text-xs text-fail">
          {errorKind === 'human-documented'
            ? t('aiReview.chatHumanDocumented')
            : t('aiReview.sendToReviewError')}
        </p>
      )}
    </div>
  )
}
