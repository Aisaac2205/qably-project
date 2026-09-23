'use client'

import Image from 'next/image'
import { Plug, Play } from '@phosphor-icons/react'
import type { DashboardRecentRun, RunSource } from '@qably/types'
import { GithubActionsIcon } from '@/components/icons/github-actions-icon'
import { StatusChip } from '@/components/ui/status-chip'
import { formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
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
  const runTitle = `${run.projectName} · ${run.name}`

  return (
    <div className="flex min-w-0 items-start gap-3 py-3">
      <div
        role="img"
        aria-label={t(sourceLabelKey(run.source))}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted"
      >
        <SourceIcon source={run.source} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p title={runTitle} className="min-w-0 truncate text-xs font-medium text-default">
            <span>{run.projectName}</span>
            <span className="text-muted"> · </span>
            <span className="text-muted">{run.name}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <StatusChip status={run.status} />
            <span className="text-xs text-muted tabular-nums">
              {formatRelativeTime(run.startedAt, timeLocale)}
            </span>
          </div>
        </div>

        {run.commitSha !== undefined ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <Image src="/logos/github.svg" alt="" width={12} height={12} className="size-3 shrink-0" />
            <span className="shrink-0 font-mono text-default">{run.commitSha.slice(0, 7)}</span>
            {run.commitMessage !== undefined ? (
              <span className="min-w-0 truncate">{run.commitMessage}</span>
            ) : null}
          </div>
        ) : null}

        <span className="text-xs text-muted tabular-nums">
          {t('dashboard.activityPassedOf', { passed: run.casesPassed, total: run.casesTotal })}
        </span>
      </div>
    </div>
  )
}
