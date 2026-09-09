'use client'

import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ReviewToolbar({
  disabled,
  decisionError,
  onConfirm,
  onReject,
  onSkip,
}: {
  disabled: boolean
  decisionError?: string | null
  onConfirm: () => void
  onReject: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2.5 px-6 py-4 border-t border-border/80 bg-surface/90 backdrop-blur-xs">
      {decisionError && (
        <p role="alert" className="text-xs text-fail font-medium">
          {decisionError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            aria-label={t('aiReview.ariaConfirmCase')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-full
              bg-primary text-primary-fg hover:bg-primary-hover active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
              focus-visible:outline-2 focus-visible:outline-primary
              shadow-2xs transition-all duration-150"
          >
            <CheckCircle size={16} weight="fill" aria-hidden="true" />
            {t('aiReview.actionApprove')}
          </button>

          <button
            type="button"
            onClick={onReject}
            disabled={disabled}
            aria-label={t('aiReview.ariaRejectCase')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-full
              bg-surface border border-fail/40 text-fail hover:bg-fail-bg/50 active:scale-[0.98]
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
            className="inline-flex items-center gap-2 px-4.5 py-2.5 text-xs sm:text-sm font-semibold rounded-full
              bg-surface border border-border/80 text-muted hover:text-default hover:bg-canvas active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
              focus-visible:outline-2 focus-visible:outline-skip
              transition-all duration-150"
          >
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
            {t('aiReview.actionSkip')}
          </button>
        </div>

        <Link
          href="/review-inbox"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-default transition-colors group"
        >
          <span>{t('reviewInbox.title')}</span>
          <ArrowSquareOut
            size={13}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
      </div>
    </div>
  )
}

