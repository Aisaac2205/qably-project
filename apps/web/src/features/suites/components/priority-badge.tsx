'use client'

import type { CasePriority } from '@qably/types'
import {
  Warning,
  ArrowUp,
  Minus,
  ArrowDown,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

const PRIORITY_CONFIG: Record<CasePriority, { labelKey: string; className: string }> = {
  critical: { labelKey: 'suites.priorityCritical', className: 'bg-fail-bg text-fail' },
  high: { labelKey: 'suites.priorityHigh', className: 'bg-warn-bg text-warn' },
  medium: { labelKey: 'suites.priorityMedium', className: 'bg-skip-bg text-muted' },
  low: { labelKey: 'suites.priorityLow', className: 'bg-surface text-muted border border-border' },
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
  const { t } = useTranslation()
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${config.className}`}>
      <PriorityIcon priority={priority} />
      {t(config.labelKey)}
    </span>
  )
}
