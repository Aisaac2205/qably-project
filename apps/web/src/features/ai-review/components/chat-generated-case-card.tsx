'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkle } from '@phosphor-icons/react'
import type { SuggestedCaseRecord } from '@qably/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { sendToReview } from '../api/chat.api'
import { chatKeys } from '../lib/query-keys'
import { projectAiReviewPath } from '@/features/projects/lib/routes'

type SendState = 'idle' | 'pending' | 'error'

export function ChatGeneratedCaseCard({
  projectId,
  threadId,
  messageId,
  caseIndex,
  suggestedCase,
  sentProposalId,
}: {
  projectId: string
  threadId: string
  messageId: string
  caseIndex: number
  suggestedCase: SuggestedCaseRecord
  sentProposalId?: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SendState>('idle')
  const [localProposalId, setLocalProposalId] = useState<string | null>(null)

  const proposalId = sentProposalId ?? localProposalId ?? undefined
  const isSent = proposalId !== undefined

  async function handleSend() {
    setState('pending')
    try {
      const result = await sendToReview(projectId, threadId, messageId, caseIndex)
      setLocalProposalId(result.proposalId)
      void queryClient.invalidateQueries({ queryKey: chatKeys.thread(projectId, threadId) })
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded border border-ai/30 bg-ai-bg p-2.5 mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ai">
        <Sparkle size={14} weight="fill" aria-hidden="true" />
        {t('aiReview.draftCaseCreated')}
      </div>
      <p className="text-xs font-medium text-default">{suggestedCase.title}</p>

      {isSent ? (
        <Link
          href={projectAiReviewPath(projectId)}
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
          {t('aiReview.sendToReviewError')}
        </p>
      )}
    </div>
  )
}
