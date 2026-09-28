import React from 'react'
import {
  CheckCircle,
  Circle,
  CircleNotch,
  Clock,
  MinusCircle,
  Prohibit,
  WarningCircle,
  XCircle,
  type Icon,
} from '@phosphor-icons/react'

export type ChipStatus =
  | 'pass'
  | 'fail'
  | 'skip'
  | 'blocked'
  | 'running'
  | 'pending'
  | 'needs-attention'
  | 'never-run'

export type ChipTone = 'pass' | 'fail' | 'blocked' | 'running' | 'muted' | 'warn'

interface ChipPresentation {
  tone: ChipTone
  Icon: Icon
  animated?: boolean
}

const PRESENTATION: Record<ChipStatus, ChipPresentation> = {
  pass: { tone: 'pass', Icon: CheckCircle },
  fail: { tone: 'fail', Icon: XCircle },
  skip: { tone: 'muted', Icon: MinusCircle },
  blocked: { tone: 'blocked', Icon: Prohibit },
  running: { tone: 'running', Icon: CircleNotch, animated: true },
  pending: { tone: 'muted', Icon: Clock },
  'needs-attention': { tone: 'warn', Icon: WarningCircle },
  'never-run': { tone: 'muted', Icon: Circle },
}

const TONE_CLASSES: Record<ChipTone, string> = {
  pass: 'bg-pass-bg text-pass',
  fail: 'bg-fail-bg text-fail',
  blocked: 'bg-blocked-bg text-blocked',
  running: 'bg-running-bg text-running',
  muted: 'bg-canvas-hover text-muted',
  warn: 'bg-warn-bg text-warn',
}

export interface StatusChipProps {
  status: ChipStatus
  label: string
}

export function StatusChip({ status, label }: StatusChipProps) {
  const presentation = PRESENTATION[status] ?? PRESENTATION.pass
  const StatusIcon = presentation.Icon

  return (
    <span
      aria-label={label}
      data-status={status}
      data-tone={presentation.tone}
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[presentation.tone]}`}
    >
      <StatusIcon
        size={12}
        weight="fill"
        aria-hidden="true"
        className={presentation.animated ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      {label}
    </span>
  )
}
