'use client'

import type { RunStatus } from '@qably/types'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

interface RunHistoryStripProps {
  history: RunStatus[]
  passRate: number
  showValue?: boolean
  className?: string
}

function toneClass(passRate: number): string {
  if (passRate >= 70) return 'text-pass'
  if (passRate > 0) return 'text-warn'
  return 'text-muted'
}

export function RunHistoryStrip({
  history,
  passRate,
  showValue = true,
  className,
}: RunHistoryStripProps) {
  const { t } = useTranslation()
  const passed = history.filter((status) => status === 'pass').length
  const failed = history.length - passed

  const label =
    history.length === 0
      ? t('suites.noRecentRuns')
      : t('suites.runHistoryAriaLabel', { count: history.length, passed, failed, rate: passRate })

  return (
    <div role="img" aria-label={label} className={cn('inline-flex items-center gap-2', className)}>
      <div className="flex items-center gap-1">
        {history.map((status, i) => (
          <span
            key={i}
            data-testid={`run-history-bar-${i}`}
            className={cn('h-4 w-1.5 rounded-sm', status === 'pass' ? 'bg-pass' : 'bg-fail')}
          />
        ))}
      </div>
      {showValue && (
        <span aria-hidden="true" className={cn('font-mono text-sm font-semibold tabular-nums', toneClass(passRate))}>
          {passRate}%
        </span>
      )}
    </div>
  )
}
