'use client'

import { Clock, CheckCircle, XCircle } from '@phosphor-icons/react'
import type { ReviewStatus } from '@qably/types'

interface AiStatusConfig {
  label: string
  className: string
}

const CONFIG: Record<ReviewStatus, AiStatusConfig> = {
  pending: { label: 'Pending', className: 'bg-skip-bg text-muted' },
  confirmed: { label: 'Confirmed', className: 'bg-pass-bg text-pass' },
  rejected: { label: 'Rejected', className: 'bg-fail-bg text-fail' },
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
  const config = CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${config.className}`}
    >
      <AiStatusIcon status={status} />
      {config.label}
    </span>
  )
}
