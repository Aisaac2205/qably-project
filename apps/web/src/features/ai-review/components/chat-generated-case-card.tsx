'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkle } from '@phosphor-icons/react'
import type { SuggestedCaseRecord } from '@qably/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { sendToReview } from '../api/chat.api'
import { projectAiReviewPath } from '@/features/projects/lib/routes'

type SendState = 'idle' | 'pending' | 'sent' | 'error'

export function ChatGeneratedCaseCard({
  projectId,
  threadId,
  messageId,
  caseIndex,
  suggestedCase,
}: {
  projectId: string
  threadId: string
  messageId: string
  caseIndex: number
  suggestedCase: SuggestedCaseRecord
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<SendState>('idle')

  async function handleSend() {
    setState('pending')
    try {
      await sendToReview(projectId, threadId, messageId, caseIndex)
      setState('sent')
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

      {state === 'sent' ? (
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
