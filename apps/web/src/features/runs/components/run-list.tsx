'use client'

import Link from 'next/link'
import type { Run, RunSource } from '@qably/types'
import { useRuns } from '@/lib/use-mock-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from './status-chip'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RunRow({ run, projectId }: { run: Run; projectId: string }) {
  return (
    <Link
      href={`/projects/${projectId}/runs/${run.id}`}
      className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-surface-hover/60 transition-colors"
    >
      <div className="min-w-0 flex-1 flex items-center gap-3.5">
        <StatusChip status={run.status} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-default truncate">{run.name}</div>
          <div className="text-xs text-muted truncate mt-0.5">{run.suiteName}</div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-4">
        <span className="text-sm font-semibold tabular-nums font-mono text-default w-12 text-right">
          {run.passRate}%
        </span>
        <Badge variant="outline" className="hidden sm:inline-flex font-normal text-xs">
          {run.source.replace('_', ' ')}
        </Badge>
        <div className="text-right hidden sm:block">
          <div className="text-xs font-medium text-default">{formatDate(run.startedAt)}</div>
          {run.finishedAt && (
            <div className="text-xs text-muted mt-0.5">{formatDate(run.finishedAt)}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function RunList({ projectId, source }: { projectId: string; source?: RunSource }) {
  const allRuns = useRuns(projectId)
  const { t } = useTranslation()
  const runs = source ? allRuns.filter((r) => r.source === source) : allRuns
  const sorted = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('runs.noRuns')}
        action={<Link
          href={`/projects/${projectId}/runs/new`}
          className="text-sm font-medium text-default hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('runs.startARun')}
        </Link>}
      />
    )
  }

  return (
    <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <CardContent className="p-0">
        <EntityList aria-label={t('runs.ariaRunCases')} className="divide-y divide-border">
        {sorted.map((r) => (
          <li key={r.id}><RunRow run={r} projectId={projectId} /></li>
        ))}
        </EntityList>
      </CardContent>
    </Card>
  )
}
