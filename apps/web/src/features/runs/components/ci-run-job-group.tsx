'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react'
import type { CiRunJobRunRecord } from '@qably/types'
import { EntityList } from '@/components/ui/entity-list'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { humanizeJobKey, reportLabelsByRun } from '../lib/ci-run-groups'
import { StatusChip } from './status-chip'

function SuiteRow({
  projectId,
  run,
  label,
}: {
  projectId: string
  run: CiRunJobRunRecord
  label?: string
}) {
  return (
    <Link
      href={`/projects/${projectId}/runs/${run.id}`}
      className="flex min-h-11 items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-runs-hover/60 focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary forced-colors:focus-visible:-outline-offset-2! sm:px-7 lg:px-9"
    >
      <StatusChip status={run.status} />
      <div className="min-w-0 flex-1">
        <p className="wrap-anywhere text-sm text-default">{run.suiteName || run.name}</p>
        {label !== undefined && <p className="mt-0.5 wrap-anywhere font-mono text-xs text-muted">{label}</p>}
      </div>
    </Link>
  )
}

function SuiteList({
  projectId,
  runs,
  label,
  reportLabels,
  className,
}: {
  projectId: string
  runs: CiRunJobRunRecord[]
  label: string
  reportLabels: Map<string, string>
  className?: string
}) {
  return (
    <EntityList aria-label={label} className={className}>
      {runs.map((run) => (
        <li key={run.id}>
          <SuiteRow projectId={projectId} run={run} label={reportLabels.get(run.id)} />
        </li>
      ))}
    </EntityList>
  )
}

export function CiRunJobGroup({
  projectId,
  ciRunExternalId,
  jobKey,
  runs,
}: {
  projectId: string
  ciRunExternalId: string
  jobKey?: string
  runs: readonly CiRunJobRunRecord[]
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const failing = runs.filter((run) => run.status === 'fail')
  const passing = runs.filter((run) => run.status !== 'fail')
  const reportLabels = reportLabelsByRun(runs, ciRunExternalId)
  const name = jobKey === undefined ? undefined : humanizeJobKey(jobKey)
  const failingLabel =
    name === undefined ? t('runs.ci.suitesAria') : t('runs.ci.groupSuitesAria', { name })
  const passingLabel =
    name === undefined
      ? t('runs.ci.suitesWithoutFailuresAria')
      : t('runs.ci.groupSuitesWithoutFailuresAria', { name })

  if (runs.length === 0) return null

  return (
    <div className="space-y-2">
      {name !== undefined && (
        <h3 className="wrap-anywhere text-sm font-semibold text-default">{name}</h3>
      )}
      <div className="rule-bleed !px-0 border-y border-border">
        {failing.length > 0 && (
          <SuiteList
            projectId={projectId}
            runs={failing}
            label={failingLabel}
            reportLabels={reportLabels}
          />
        )}
        {passing.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((open) => !open)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 px-5 text-left text-sm font-medium text-muted transition-colors hover:bg-runs-hover/60 hover:text-default focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary forced-colors:focus-visible:-outline-offset-2! sm:px-7 lg:px-9',
                failing.length > 0 && 'border-t border-border',
              )}
            >
              <CaretRight
                size={14}
                weight="bold"
                aria-hidden="true"
                className={cn('shrink-0', expanded && 'rotate-90')}
              />
              {t(expanded ? 'runs.ci.suitesHide' : 'runs.ci.suitesShow', { count: passing.length })}
            </button>
            <div id={panelId}>
              {expanded && (
                <SuiteList
                  projectId={projectId}
                  runs={passing}
                  label={passingLabel}
                  reportLabels={reportLabels}
                  className="border-t border-border"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
