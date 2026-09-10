'use client'

import { CopySimple } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { Skeleton } from '@/components/ui/skeleton'
import { useDuplicateCandidates } from '../hooks/use-duplicate-candidates'
import type { DuplicateMatchReason } from '@qably/types'

const REASON_KEY: Record<DuplicateMatchReason, string> = {
  'automation-key': 'aiReview.duplicateReasonAutomationKey',
  title: 'aiReview.duplicateReasonSameTitle',
  'token-overlap': 'aiReview.duplicateReasonSimilarTitle',
}

export function DuplicateComparison({ proposalId }: { proposalId: string }) {
  const { t } = useTranslation()
  const { candidates, isLoading, isError } = useDuplicateCandidates(proposalId)
  const showNotFound = !isLoading && (isError || candidates.length === 0)
  const showCandidates = !isLoading && !isError && candidates.length > 0

  return (
    <div className="rounded border border-warn/30 bg-warn-bg p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-warn">
        <CopySimple size={16} weight="bold" aria-hidden="true" />
        {t('aiReview.possibleDuplicate')}
      </div>

      {isLoading && (
        <div className="space-y-1.5" role="status" aria-label={t('aiReview.possibleDuplicate')}>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      )}

      {showNotFound && (
        <p className="text-sm text-muted leading-relaxed">
          {t('aiReview.duplicateNotFound')}
        </p>
      )}

      {showCandidates && (
        <ul className="space-y-2.5">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="space-y-0.5">
              <p className="text-sm font-medium text-default truncate">
                {candidate.title}
              </p>
              <p className="text-xs text-muted">{t(REASON_KEY[candidate.matchReason])}</p>
              <p className="text-xs text-muted truncate">{candidate.expectedResult}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
