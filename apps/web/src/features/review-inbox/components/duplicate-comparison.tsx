'use client'

import { useId } from 'react'
import { ArrowsClockwise, CopySimple } from '@phosphor-icons/react'
import type { ProposalClassification } from '../api/review.api'
import {
  classificationReasonKey,
  classificationScorePercent,
} from '../lib/classification-reason'
import { useTranslation } from '@/lib/i18n'

export function DuplicateComparison({
  classification,
}: {
  classification: ProposalClassification
}) {
  const { t } = useTranslation()
  const reasonsHeadingId = useId()

  if (classification.kind === 'none') return null

  const isUpdate = classification.kind === 'update'
  const percent = classificationScorePercent(classification.score)
  const hasCrossSuiteNote = classification.reasons.includes('cross-suite-key')
  const displayedReasons = classification.reasons.filter(
    (reason) => reason !== 'cross-suite-key',
  )

  return (
    <div className="rounded border border-warn/30 bg-warn-bg p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-warn">
        {isUpdate ? (
          <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
        ) : (
          <CopySimple size={16} weight="bold" aria-hidden="true" />
        )}
        {isUpdate
          ? t('reviewInbox.classificationUpdate')
          : t('reviewInbox.classificationPossibleDuplicate')}
      </div>

      {displayedReasons.length > 0 && (
        <div>
          <h4 className="sr-only" id={reasonsHeadingId}>
            {t('reviewInbox.classificationReasonsHeading')}
          </h4>
          <ul className="flex flex-wrap gap-1.5" aria-labelledby={reasonsHeadingId}>
          {displayedReasons.map((reason) => (
            <li
              key={reason}
              className="rounded-full border border-warn/30 bg-surface px-2 py-0.5 text-xs text-default"
            >
              {t(`reviewInbox.${classificationReasonKey(reason)}`)}
            </li>
          ))}
          </ul>
        </div>
      )}

      {percent !== null && (
        <p className="text-xs text-muted">
          {t('reviewInbox.classificationScore', { percent })}
        </p>
      )}

      {hasCrossSuiteNote && (
        <p className="text-xs text-muted leading-relaxed">
          {t('reviewInbox.classificationCrossSuiteNote')}
        </p>
      )}
    </div>
  )
}
