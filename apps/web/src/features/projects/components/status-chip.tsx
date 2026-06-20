'use client'

import {
  CheckCircle,
  XCircle,
  CircleNotch,
  MinusCircle,
  Prohibit,
  ProhibitInset,
  Question,
} from '@phosphor-icons/react'
import type { RunStatus } from '@qably/types'

type ChipStatus = RunStatus | 'skip' | 'blocked' | 'cancelled' | 'draft' | 'deprecated'

interface StatusConfig {
  label: string
  className: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  pass: { label: 'Pass', className: 'bg-pass-bg text-pass' },
  fail: { label: 'Fail', className: 'bg-fail-bg text-fail' },
  skip: { label: 'Skip', className: 'bg-skip-bg text-skip' },
  blocked: { label: 'Blocked', className: 'bg-blocked-bg text-blocked' },
  running: { label: 'Running', className: 'bg-running-bg text-running' },
  pending: { label: 'Pending', className: 'bg-skip-bg text-muted' },
  cancelled: { label: 'Cancelled', className: 'bg-skip-bg text-muted' },
  draft: { label: 'Draft', className: 'bg-warn-bg text-warn' },
  deprecated: { label: 'Deprecated', className: 'bg-skip-bg text-muted' },
}

function StatusIcon({ status }: { status: string }) {
  const size = 12
  switch (status) {
    case 'pass':
      return <CheckCircle size={size} weight="fill" aria-hidden="true" />
    case 'fail':
      return <XCircle size={size} weight="fill" aria-hidden="true" />
    case 'running':
      return <CircleNotch size={size} weight="bold" className="animate-spin" aria-hidden="true" />
    case 'pending':
      return <MinusCircle size={size} weight="fill" aria-hidden="true" />
    case 'skip':
      return <MinusCircle size={size} weight="fill" aria-hidden="true" />
    case 'blocked':
      return <Prohibit size={size} weight="fill" aria-hidden="true" />
    case 'cancelled':
      return <ProhibitInset size={size} weight="fill" aria-hidden="true" />
    default:
      return <Question size={size} weight="fill" aria-hidden="true" />
  }
}

export function StatusChip({ status }: { status: ChipStatus }) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.pending
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${config.className}`}
    >
      <StatusIcon status={status} />
      {config.label}
    </span>
  )
}
