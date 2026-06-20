'use client'

import {
  CheckCircle,
  XCircle,
  ArrowRight,
} from '@phosphor-icons/react'

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
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-surface">
      <button
        onClick={onConfirm}
        disabled={disabled}
        aria-label="Confirm case"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded
          bg-primary text-primary-fg hover:bg-primary-hover
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-primary
          transition-colors"
      >
        <CheckCircle size={14} weight="fill" aria-hidden="true" />
        Confirm
      </button>

      <button
        onClick={onReject}
        disabled={disabled}
        aria-label="Reject case"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded
          bg-fail-bg text-fail hover:bg-fail-bg/80
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-fail
          transition-colors"
      >
        <XCircle size={14} weight="fill" aria-hidden="true" />
        Reject
      </button>

      <button
        onClick={onSkip}
        disabled={disabled}
        aria-label="Skip case"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded
          bg-skip-bg text-skip hover:bg-skip-bg/80
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-skip
          transition-colors"
      >
        <ArrowRight size={14} weight="bold" aria-hidden="true" />
        Skip
      </button>
    </div>
  )
}
