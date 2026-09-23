'use client'

import { GithubLogo, Plug, Play } from '@phosphor-icons/react'
import type { DashboardRecentRun, RunSource } from '@qably/types'
import { GithubActionsIcon } from '@/components/icons/github-actions-icon'
import { StatusChip } from '@/components/ui/status-chip'
import { formatKpiValue, formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

export interface ActivityRowProps {
  run: DashboardRecentRun
}

function sourceLabelKey(source: RunSource): string {
  if (source === 'github_actions') return 'runs.sourceCi'
  if (source === 'api') return 'runs.sourceApi'
  return 'runs.sourceManual'
}

function SourceIcon({ source }: { source: RunSource }) {
  if (source === 'github_actions') {
    return <GithubActionsIcon className="size-4 text-brand-github-actions" />
  }
  if (source === 'api') {
    return <Plug size={16} weight="bold" aria-hidden="true" />
  }
  return <Play size={16} weight="fill" aria-hidden="true" />
}

export function ActivityRow({ run }: ActivityRowProps) {
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          role="img"
          aria-label={t(sourceLabelKey(run.source))}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted"
        >
          <SourceIcon source={run.source} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-default">{run.name}</p>
          {run.commitSha !== undefined ? (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
              <GithubLogo size={12} weight="fill" aria-hidden="true" className="shrink-0" />
              <span className="font-mono text-default">{run.commitSha.slice(0, 7)}</span>
              {run.commitMessage !== undefined ? (
                <span className="truncate">{run.commitMessage}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusChip status={run.status} />
        <span className="text-xs text-muted tabular-nums">
          {t('dashboard.activityPassedOf', { passed: run.casesPassed, total: run.casesTotal })}
        </span>
        <span className="w-10 text-right text-xs font-semibold text-default tabular-nums">
          {formatKpiValue('passRate', run.passRate)}
        </span>
        <span className="text-xs text-muted tabular-nums">
          {formatRelativeTime(run.startedAt, timeLocale)}
        </span>
      </div>
    </div>
  )
}
