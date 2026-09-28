import React from 'react'
import { Plug, Play } from '@phosphor-icons/react'
import type { DashboardActivityEntry, RunSource } from '@qably/types'
import { GithubActionsIcon } from '@/components/icons/github-actions-icon'
import { formatEventCount, formatRelativeTime, type FormatLocale } from '../lib/format'
import { useTranslation } from '@/lib/i18n'
import { ActivityEntryRow } from './activity-entry-row'

export interface ActivityRowProps {
  entry: DashboardActivityEntry
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

const STATUS_LABELS: Record<string, string> = {
  pass: 'Aprobado',
  fail: 'Fallido',
  running: 'En ejecución',
  pending: 'Pendiente',
}

export function ActivityRow({ entry }: ActivityRowProps) {
  const { t, locale } = useTranslation()
  const numberLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const statusLabel = STATUS_LABELS[entry.status] ?? entry.status
  const relativeTime = formatRelativeTime(entry.occurredAt, numberLocale)
  const sourceIcon = <SourceIcon source={entry.source} />
  const sourceLabel = t(sourceLabelKey(entry.source))

  if (entry.kind === 'commit') {
    const casesSummary = t('dashboard.activitySuitesCases', {
      count: entry.suiteCount,
      passed: formatEventCount(entry.casesPassed, numberLocale),
      total: formatEventCount(entry.casesTotal, numberLocale),
    })

    return (
      <ActivityEntryRow
        kind="commit"
        projectName={entry.projectName}
        status={entry.status}
        statusLabel={statusLabel}
        relativeTime={relativeTime}
        occurredAt={entry.occurredAt}
        casesSummary={casesSummary}
        sourceIcon={sourceIcon}
        sourceLabel={sourceLabel}
        commitIcon={<img src="/logos/github.svg" alt="" width={12} height={12} className="size-3 shrink-0" />}
        commitSha={entry.commitSha}
        commitMessage={entry.commitMessage}
      />
    )
  }

  const casesSummary = t('dashboard.activityPassedOf', {
    passed: formatEventCount(entry.casesPassed, numberLocale),
    total: formatEventCount(entry.casesTotal, numberLocale),
  })

  return (
    <ActivityEntryRow
      kind="run"
      projectName={entry.projectName}
      runName={entry.runName}
      status={entry.status}
      statusLabel={statusLabel}
      relativeTime={relativeTime}
      occurredAt={entry.occurredAt}
      casesSummary={casesSummary}
      sourceIcon={sourceIcon}
      sourceLabel={sourceLabel}
    />
  )
}
