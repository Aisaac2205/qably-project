'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react'
import type { CiRunJobRunRecord } from '@qably/types'
import { EntityList } from '@/components/ui/entity-list'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { humanizeJobKey } from '../lib/ci-run-groups'
import { StatusChip } from './status-chip'

function SuiteRow({ projectId, run }: { projectId: string; run: CiRunJobRunRecord }) {
  return (
    <Link
      href={`/projects/${projectId}/runs/${run.id}`}
      className="flex min-h-11 items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-surface-hover/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-7 lg:px-9"
    >
      <StatusChip status={run.status} />
      <p className="min-w-0 flex-1 truncate text-sm text-default">{run.suiteName || run.name}</p>
    </Link>
  )
}

function SuiteList({
  projectId,
  runs,
  label,
  className,
}: {
  projectId: string
  runs: CiRunJobRunRecord[]
  label: string
  className?: string
}) {
  return (
    <EntityList aria-label={label} className={className}>
      {runs.map((run) => (
        <li key={run.id}>
          <SuiteRow projectId={projectId} run={run} />
        </li>
      ))}
    </EntityList>
  )
}

export function CiRunJobGroup({
  projectId,
  jobKey,
  runs,
}: {
  projectId: string
  jobKey?: string
  runs: readonly CiRunJobRunRecord[]
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const failing = runs.filter((run) => run.status === 'fail')
  const passing = runs.filter((run) => run.status !== 'fail')
  const listLabel =
    jobKey === undefined
      ? t('runs.ci.suitesAria')
      : t('runs.ci.groupSuitesAria', { name: humanizeJobKey(jobKey) })

  return (
    <div className="space-y-2">
      {jobKey !== undefined && (
        <h3 className="text-sm font-semibold text-default">{humanizeJobKey(jobKey)}</h3>
      )}
      <div className="rule-bleed !px-0 border-y border-border">
        {failing.length > 0 && <SuiteList projectId={projectId} runs={failing} label={listLabel} />}
        {passing.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((open) => !open)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 px-5 text-left text-sm font-medium text-muted transition-colors hover:bg-surface-hover/60 hover:text-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-7 lg:px-9',
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
                  label={listLabel}
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
