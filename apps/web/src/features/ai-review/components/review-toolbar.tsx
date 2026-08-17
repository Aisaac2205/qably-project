'use client'

import {
  CheckCircle,
  XCircle,
  ArrowRight,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ReviewToolbar({
  disabled,
  onConfirm,
  onReject,
  onSkip,
}: {
  disabled: boolean
  onConfirm: () => void
  onReject: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-5 py-4 border-t border-border bg-surface/90 backdrop-blur-xs">
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        aria-label={t('aiReview.ariaConfirmCase')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg
          bg-primary text-primary-fg hover:bg-primary-hover active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          focus-visible:outline-2 focus-visible:outline-primary
          shadow-xs transition-all duration-150"
      >
        <CheckCircle size={16} weight="fill" aria-hidden="true" />
        {t('aiReview.actionApprove')}
      </button>

      <button
        type="button"
        onClick={onReject}
        disabled={disabled}
        aria-label={t('aiReview.ariaRejectCase')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg
          bg-fail-bg text-fail hover:bg-fail-bg/80 active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          focus-visible:outline-2 focus-visible:outline-fail
          transition-all duration-150"
      >
        <XCircle size={16} weight="fill" aria-hidden="true" />
        {t('aiReview.actionReject')}
      </button>

      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        aria-label={t('aiReview.ariaSkipCase')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg
          bg-skip-bg text-skip hover:bg-skip-bg/80 active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          focus-visible:outline-2 focus-visible:outline-skip
          transition-all duration-150"
      >
        <ArrowRight size={16} weight="bold" aria-hidden="true" />
        {t('aiReview.actionSkip')}
      </button>
    </div>
  )
}
