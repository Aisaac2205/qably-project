'use client'

/**
 * SuiteRow — enriched row for the suites list.
 *
 * Desktop layout (md+): 6-column grid
 *   [icon] [info: name + description + tags + default] [cases] [last run] [pass + sparkline] [status]
 * Mobile layout: 2 columns (icon + info + status)
 */
import { memo } from 'react'
import { TestTube, Star } from '@phosphor-icons/react'
import type { Suite } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from '@/components/ui/status-chip'
import { Sparkline } from './sparkline'
import { InlineEditableText } from './inline-editable-text'
import { updateSuite } from '@/lib/mock-store'
import type { SuiteMetrics } from '@/features/suites/hooks/use-suite-metrics'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatRelative(iso: string | undefined): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((then - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}

const STATUS_TONE: Record<string, 'text-pass' | 'text-fail' | 'text-warn' | 'text-running' | 'text-muted'> = {
  pass: 'text-pass',
  fail: 'text-fail',
  running: 'text-running',
  'needs-attention': 'text-warn',
  'never-run': 'text-muted',
}

interface SuiteRowProps {
  suite: Suite
  metrics: SuiteMetrics
}

function SuiteRowImpl({ suite, metrics }: SuiteRowProps) {
  const { lastRun, passRate7d, sparkline, status } = metrics
  const toneClass = STATUS_TONE[status] ?? 'text-muted'

  function handleSave(newName: string) {
    updateSuite(suite.id, { name: newName })
  }

  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 md:gap-4 items-center py-3 px-3 md:px-4 hover:bg-canvas transition-colors group"
      data-testid={`suite-row-${suite.id}`}
    >
      {/* Col 1: status-tinted icon */}
      <TestTube
        size={20}
        weight="duotone"
        className={`${toneClass} shrink-0`}
        aria-hidden="true"
      />

      {/* Col 2: name + description + tags + default */}
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <InlineEditableText
            value={suite.name}
            onSave={handleSave}
            ariaLabel={`Edit suite name: ${suite.name}`}
          />
          {suite.isDefault && (
            <span
              className="inline-flex items-center text-warn shrink-0"
              title="Default suite"
            >
              <Star size={12} weight="fill" aria-hidden="true" />
              <span className="sr-only">Default suite</span>
            </span>
          )}
        </div>
        {suite.description && (
          <p className="text-[11px] text-muted truncate">{suite.description}</p>
        )}
        {suite.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {suite.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Col 3: cases count (hidden on mobile) */}
      <div className="hidden md:flex flex-col items-end shrink-0">
        <span className="text-sm font-mono font-semibold text-default tabular-nums">
          {suite.cases.length}
        </span>
        <span className="text-[10px] text-muted">{suite.cases.length === 1 ? 'case' : 'cases'}</span>
      </div>

      {/* Col 4: last run reference (hidden on mobile) */}
      <div className="hidden md:flex flex-col items-end shrink-0 w-24">
        <span className="text-xs text-default">
          {formatRelative(lastRun?.startedAt)}
        </span>
        <span className="text-[10px] text-muted">
          {lastRun?.source === 'github_actions' ? 'CI' : lastRun ? 'Manual' : ''}
        </span>
      </div>

      {/* Col 5: pass rate 7d + sparkline (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <span
          className={`text-sm font-mono font-semibold tabular-nums ${passRate7d >= 70 ? 'text-pass' : passRate7d > 0 ? 'text-warn' : 'text-muted'}`}
        >
          {passRate7d}%
        </span>
        <Sparkline
          data={sparkline.map(({ date, passRate }) => ({ date, passRate }))}
          tone={passRate7d >= 70 ? 'pass' : passRate7d > 0 ? 'warn' : 'muted'}
          width={64}
          height={20}
        />
      </div>

      {/* Col 6: status chip (visible on all sizes) */}
      <div className="flex justify-end shrink-0">
        <StatusChip status={status} />
      </div>
    </div>
  )
}

export const SuiteRow = memo(SuiteRowImpl)
