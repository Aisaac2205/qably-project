'use client'

import {
  CheckCircle,
  XCircle,
  CircleNotch,
  MinusCircle,
  Prohibit,
  ProhibitInset,
  Question,
  WarningCircle,
  Circle,
} from '@phosphor-icons/react'
import type { RunStatus, SuiteRunStatus } from '@qably/types'

type ChipStatus =
  | RunStatus
  | SuiteRunStatus
  | 'skip'
  | 'blocked'
  | 'cancelled'
  | 'draft'
  | 'deprecated'

interface StatusConfig {
  label: string
  className: string
  icon: 'check' | 'x' | 'spinner' | 'minus' | 'prohibit' | 'prohibitInset' | 'question' | 'warning' | 'circle'
}

const STATUS_MAP: Record<string, StatusConfig> = {
  pass: { label: 'Pass', className: 'bg-pass-bg text-pass', icon: 'check' },
  fail: { label: 'Fail', className: 'bg-fail-bg text-fail', icon: 'x' },
  skip: { label: 'Skip', className: 'bg-skip-bg text-skip', icon: 'minus' },
  blocked: { label: 'Blocked', className: 'bg-blocked-bg text-blocked', icon: 'prohibit' },
  running: { label: 'Running', className: 'bg-running-bg text-running', icon: 'spinner' },
  pending: { label: 'Pending', className: 'bg-skip-bg text-muted', icon: 'minus' },
  cancelled: { label: 'Cancelled', className: 'bg-skip-bg text-muted', icon: 'prohibitInset' },
  draft: { label: 'Draft', className: 'bg-warn-bg text-warn', icon: 'warning' },
  deprecated: { label: 'Deprecated', className: 'bg-skip-bg text-muted', icon: 'minus' },
  'never-run': { label: 'Never run', className: 'bg-skip-bg text-muted', icon: 'circle' },
  'needs-attention': { label: 'Needs attention', className: 'bg-warn-bg text-warn', icon: 'warning' },
}

function StatusIcon({ icon }: { icon: StatusConfig['icon'] }) {
  const size = 12
  switch (icon) {
    case 'check':
      return <CheckCircle size={size} weight="fill" aria-hidden="true" />
    case 'x':
      return <XCircle size={size} weight="fill" aria-hidden="true" />
    case 'spinner':
      return <CircleNotch size={size} weight="bold" className="animate-spin" aria-hidden="true" />
    case 'minus':
      return <MinusCircle size={size} weight="fill" aria-hidden="true" />
    case 'prohibit':
      return <Prohibit size={size} weight="fill" aria-hidden="true" />
    case 'prohibitInset':
      return <ProhibitInset size={size} weight="fill" aria-hidden="true" />
    case 'warning':
      return <WarningCircle size={size} weight="fill" aria-hidden="true" />
    case 'circle':
      return <Circle size={size} weight="fill" aria-hidden="true" />
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
      <StatusIcon icon={config.icon} />
      {config.label}
    </span>
  )
}
