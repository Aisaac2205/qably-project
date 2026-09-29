'use client'

import Link from 'next/link'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import type { InboxFeedbackToast } from '../hooks/use-inbox-feedback'
import { useTranslation } from '@/lib/i18n'

export type ReviewInboxFeedbackContent = Pick<
  InboxFeedbackToast,
  'message' | 'type' | 'href' | 'linkLabel'
>

export interface ReviewInboxFeedbackProps {
  toast: ReviewInboxFeedbackContent | null
  count?: number
  onDismiss: () => void
}

export function ReviewInboxFeedback({ toast, count = 1, onDismiss }: ReviewInboxFeedbackProps) {
  const { t } = useTranslation()

  if (!toast) return null

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-xs font-medium transition-all duration-200 ${
        toast.type === 'success'
          ? 'border-pass/40 bg-pass-bg/20 text-pass'
          : toast.type === 'error'
            ? 'border-fail/40 bg-fail-bg/20 text-fail'
            : 'border-border bg-surface text-default'
      }`}
    >
      <div className="flex items-start gap-2 min-w-0">
        {toast.type === 'success' ? (
          <CheckCircle size={16} weight="fill" aria-hidden="true" className="shrink-0" />
        ) : toast.type === 'error' ? (
          <WarningCircle size={16} weight="fill" aria-hidden="true" className="shrink-0" />
        ) : (
          <Info size={16} weight="fill" aria-hidden="true" className="shrink-0" />
        )}
        <span className="min-w-0 break-words">
          {toast.message}
          {toast.href && (
            <>
              {' '}
              <Link
                href={toast.href}
                className="rounded-sm font-semibold underline outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                {toast.linkLabel}
              </Link>
            </>
          )}
          {count > 1 ? (
            <span className="mt-1 block font-normal">
              {t('reviewInbox.errorRepeated', { count })}
            </span>
          ) : null}
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.dismiss')}
        className="-m-3 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-colors hover:bg-canvas hover:text-default focus-visible:ring-2 focus-visible:ring-primary md:-m-2 md:size-8"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
