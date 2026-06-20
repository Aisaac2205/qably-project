'use client'

import Link from 'next/link'
import type { Run } from '@qably/types'
import { useRuns } from '@/lib/use-mock-store'
import { StatusChip } from './status-chip'

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
      className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <StatusChip status={run.status} />
        <div className="min-w-0">
          <div className="text-xs font-medium text-default truncate">{run.name}</div>
          <div className="text-[10px] text-muted truncate">{run.suiteName}</div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-4">
        <span className="text-sm font-semibold tabular-nums font-mono text-default w-10 text-right">
          {run.passRate}%
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sidebar-hover text-sidebar-fg-muted uppercase hidden sm:inline">
          {run.source}
        </span>
        <div className="text-right hidden sm:block">
          <div className="text-[11px] text-muted">{formatDate(run.startedAt)}</div>
          {run.finishedAt && (
            <div className="text-[11px] text-muted">{formatDate(run.finishedAt)}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function RunList({ projectId }: { projectId: string }) {
  const runs = useRuns(projectId)
  const sorted = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted">No runs yet</p>
        <Link
          href={`/projects/${projectId}/runs/new`}
          className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
        >
          Start a run
        </Link>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border bg-surface rounded border border-border">
      {sorted.map((r) => (
        <RunRow key={r.id} run={r} projectId={projectId} />
      ))}
    </div>
  )
}
