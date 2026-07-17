'use client'

import {
  CheckCircle,
  XCircle,
  ArrowRight,
  Checks,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ReviewToolbar({
  disabled,
  onConfirm,
  onReject,
  onSkip,
  onConfirmAll,
  pendingCount,
}: {
  disabled: boolean
  onConfirm: () => void
  onReject: () => void
  onSkip: () => void
  onConfirmAll: () => void
  pendingCount: number
}) {
  const { t } = useTranslation()
  
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-surface">
      <button
        onClick={onConfirm}
        disabled={disabled}
        aria-label={t('aiReview.ariaConfirmCase')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded
          bg-primary text-primary-fg hover:bg-primary-hover
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-primary
          transition-colors"
      >
        <CheckCircle size={14} weight="fill" aria-hidden="true" />
        {t('common.confirm')}
      </button>

      <button
        onClick={onReject}
        disabled={disabled}
        aria-label={t('aiReview.ariaRejectCase')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded
          bg-fail-bg text-fail hover:bg-fail-bg/80
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-fail
          transition-colors"
      >
        <XCircle size={14} weight="fill" aria-hidden="true" />
        {t('common.reject')}
      </button>

      <button
        onClick={onSkip}
        disabled={disabled}
        aria-label={t('aiReview.ariaSkipCase')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded
          bg-skip-bg text-skip hover:bg-skip-bg/80
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-skip
          transition-colors"
      >
        <ArrowRight size={14} weight="bold" aria-hidden="true" />
        {t('common.skip')}
      </button>

      <button
        onClick={onConfirmAll}
        disabled={pendingCount === 0}
        aria-label={t('aiReview.ariaConfirmAll', { count: pendingCount })}
        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded
          border border-border text-default hover:bg-canvas
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-primary
          transition-colors"
      >
        <Checks size={14} weight="bold" aria-hidden="true" />
        {t('aiReview.confirmAll')}
      </button>
    </div>
  )
}
