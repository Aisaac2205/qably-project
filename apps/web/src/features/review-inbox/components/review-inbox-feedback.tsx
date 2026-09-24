'use client'

import Link from 'next/link'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import type { InboxFeedbackToast } from '../hooks/use-inbox-feedback'
import { useTranslation } from '@/lib/i18n'

export interface ReviewInboxFeedbackProps {
  toast: InboxFeedbackToast | null
  onDismiss: () => void
}

export function ReviewInboxFeedback({ toast, onDismiss }: ReviewInboxFeedbackProps) {
  const { t } = useTranslation()

  if (!toast) return null

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs font-medium transition-all duration-200 ${
        toast.type === 'success'
          ? 'border-pass/40 bg-pass-bg/20 text-pass'
          : toast.type === 'error'
            ? 'border-fail/40 bg-fail-bg/20 text-fail'
            : 'border-border bg-surface text-default'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {toast.type === 'success' ? (
          <CheckCircle size={16} weight="fill" aria-hidden="true" />
        ) : toast.type === 'error' ? (
          <WarningCircle size={16} weight="fill" aria-hidden="true" />
        ) : (
          <Info size={16} weight="fill" aria-hidden="true" />
        )}
        <span className="truncate">{toast.message}</span>
        {toast.href && (
          <Link href={toast.href} className="font-semibold underline hover:text-primary shrink-0">
            {toast.linkLabel}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.cancel')}
        className="rounded p-1 hover:bg-canvas text-muted hover:text-default transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
