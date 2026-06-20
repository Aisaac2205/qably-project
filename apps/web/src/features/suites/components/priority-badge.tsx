'use client'

import type { CasePriority } from '@qably/types'
import {
  Warning,
  ArrowUp,
  Minus,
  ArrowDown,
} from '@phosphor-icons/react'

const PRIORITY_CONFIG: Record<CasePriority, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-fail-bg text-fail' },
  high: { label: 'High', className: 'bg-warn-bg text-warn' },
  medium: { label: 'Medium', className: 'bg-skip-bg text-muted' },
  low: { label: 'Low', className: 'bg-surface text-muted border border-border' },
}

function PriorityIcon({ priority }: { priority: CasePriority }) {
  const size = 10
  switch (priority) {
    case 'critical':
      return <Warning size={size} weight="fill" aria-hidden="true" />
    case 'high':
      return <ArrowUp size={size} weight="bold" aria-hidden="true" />
    case 'medium':
      return <Minus size={size} weight="bold" aria-hidden="true" />
    case 'low':
      return <ArrowDown size={size} weight="bold" aria-hidden="true" />
  }
}

export function PriorityBadge({ priority }: { priority: CasePriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${config.className}`}>
      <PriorityIcon priority={priority} />
      {config.label}
    </span>
  )
}
