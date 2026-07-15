'use client'

import { Clock, CheckCircle, XCircle } from '@phosphor-icons/react'
import type { ReviewStatus } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

interface AiStatusConfig {
  labelKey: string
  className: string
}

const CONFIG: Record<ReviewStatus, AiStatusConfig> = {
  pending: { labelKey: 'aiReview.statusPending', className: 'bg-skip-bg text-muted' },
  confirmed: { labelKey: 'aiReview.statusConfirmed', className: 'bg-pass-bg text-pass' },
  rejected: { labelKey: 'aiReview.statusRejected', className: 'bg-fail-bg text-fail' },
}

function AiStatusIcon({ status }: { status: ReviewStatus }) {
  const size = 12
  switch (status) {
    case 'pending':
      return <Clock size={size} weight="fill" aria-hidden="true" />
    case 'confirmed':
      return <CheckCircle size={size} weight="fill" aria-hidden="true" />
    case 'rejected':
      return <XCircle size={size} weight="fill" aria-hidden="true" />
  }
}

export function AiStatusChip({ status }: { status: ReviewStatus }) {
  const { t } = useTranslation()
  const config = CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${config.className}`}
    >
      <AiStatusIcon status={status} />
      {t(config.labelKey)}
    </span>
  )
}
