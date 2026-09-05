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
import { useUpdateSuite } from '@/features/projects/suites/hooks/use-suite-mutations'
import type { SuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

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
  const { t, locale } = useTranslation()
  const updateSuiteMutation = useUpdateSuite()

  function handleSave(newName: string) {
    updateSuiteMutation.mutate({ id: suite.id, patch: { name: newName } })
  }

  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3.5 md:gap-4 items-center py-3.5 px-4 sm:px-5 hover:bg-surface-hover/60 transition-colors group"
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
            ariaLabel={t('suites.editSuiteName', { name: suite.name })}
          />
          {suite.isDefault && (
            <span
              className="inline-flex items-center text-warn shrink-0"
              title={t('suites.defaultSuite')}
            >
              <Star size={12} weight="fill" aria-hidden="true" />
              <span className="sr-only">{t('suites.defaultSuite')}</span>
            </span>
          )}
        </div>
        {suite.description && (
          <p className="text-xs text-muted truncate text-wrap-pretty mt-0.5">{suite.description}</p>
        )}
        {suite.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {suite.tags.map((tagItem) => (
              <Badge key={tagItem} variant="outline" className="text-xs font-normal">
                {tagItem}
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
        <span className="text-xs text-muted mt-0.5">{suite.cases.length === 1 ? t('suites.caseSuffix_one') : t('suites.caseSuffix_other')}</span>
      </div>

      {/* Col 4: last run reference (hidden on mobile) */}
      <div className="hidden md:flex flex-col items-end shrink-0 w-24">
        <span className="text-xs font-medium text-default">
          {formatRelative(lastRun?.startedAt, locale, t('suites.never'))}
        </span>
        <span className="text-xs text-muted mt-0.5">
          {lastRun?.source === 'github_actions' ? t('suites.sourceCi') : lastRun ? t('suites.sourceManual') : ''}
        </span>
      </div>

      {/* Col 5: pass rate 7d + sparkline (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0">
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
