'use client'

/**
 * SuiteRow — enriched row for the suites list.
 *
 * Desktop layout (md+): 6-column grid
 *   [icon] [info: name + description + tags + default] [cases] [last run] [pass + sparkline] [status]
 * Mobile layout: 2 columns (icon + info + status)
 */
import { memo } from 'react'
import Image from 'next/image'
import { TestTube, Star, PencilSimple } from '@phosphor-icons/react'
import type { Suite } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from '@/components/ui/status-chip'
import { RunHistoryStrip } from './run-history-strip'
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
  const { lastRun, recentPassRate, history, status } = metrics
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

      {/* Col 3: case composition, icon-only (hidden on mobile) */}
      <div
        role="img"
        aria-label={
          [
            suite.automatedCases > 0
              ? t('suites.automatedCasesCount', { count: suite.automatedCases })
              : null,
            suite.manualCases > 0
              ? t('suites.manualCasesCount', { count: suite.manualCases })
              : null,
          ]
            .filter((part): part is string => part !== null)
            .join(' · ') || `${suite.cases.length} ${t('suites.caseSuffix_other')}`
        }
        className="hidden md:flex items-center gap-2 shrink-0 w-12"
      >
        {suite.automatedCases > 0 && (
          <Image src="/logos/github.svg" alt="" width={18} height={18} aria-hidden="true" className="opacity-70" />
        )}
        {suite.manualCases > 0 && (
          <PencilSimple size={18} weight="bold" aria-hidden="true" className="text-muted" />
        )}
        {suite.automatedCases === 0 && suite.manualCases === 0 && (
          <span className="text-xs text-muted" aria-hidden="true">0</span>
        )}
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

      {/* Col 5: run history strip (hidden on mobile) */}
      <div className="hidden md:flex items-center justify-end shrink-0 w-20">
        <RunHistoryStrip history={history} passRate={recentPassRate} />
      </div>

      {/* Col 6: status chip (visible on all sizes). Fixed width sized to the
          longest status label ("Requiere atención") so this column — and
          the 1fr name column before it — align the same way on every row. */}
      <div className="flex justify-end shrink-0 md:w-32">
        <StatusChip status={status} />
      </div>
    </div>
  )
}

export const SuiteRow = memo(SuiteRowImpl)
