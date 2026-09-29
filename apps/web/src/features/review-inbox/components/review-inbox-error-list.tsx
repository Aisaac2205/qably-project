'use client'

import { useId } from 'react'
import { useTranslation } from '@/lib/i18n'
import type { InboxFeedbackToast } from '../hooks/use-inbox-feedback'
import { summarizeErrors } from '../lib/summarize-feedback-errors'
import { ReviewInboxFeedback } from './review-inbox-feedback'

export interface ReviewInboxErrorListProps {
  errors: readonly InboxFeedbackToast[]
  onDismiss: (ids: readonly number[]) => void
}

export function ReviewInboxErrorList({ errors, onDismiss }: ReviewInboxErrorListProps) {
  const { t } = useTranslation()
  const hiddenLineId = useId()

  if (errors.length === 0) return null

  const { visible, hiddenCount, hiddenIds } = summarizeErrors(errors)

  return (
    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto overscroll-contain">
      {visible.map((group) => (
        <ReviewInboxFeedback
          key={group.toast.id}
          toast={group.toast}
          count={group.count}
          onDismiss={() => onDismiss(group.ids)}
        />
      ))}
      {hiddenCount > 0 ? (
        <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted">
          <span id={hiddenLineId}>{t('reviewInbox.hiddenErrors', { count: hiddenCount })}</span>
          <button
            type="button"
            onClick={() => onDismiss(hiddenIds)}
            aria-describedby={hiddenLineId}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 font-medium text-default outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary md:min-h-8"
          >
            {t('reviewInbox.clearErrors')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
