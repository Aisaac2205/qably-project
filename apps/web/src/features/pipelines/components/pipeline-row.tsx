'use client'

import Link from 'next/link'
import { GitBranch, Clock } from '@phosphor-icons/react'
import type { PipelineRun } from '@qably/types'
import { StatusChip } from '@/features/projects/components/status-chip'

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

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

export function PipelineRow({ p, projectId }: { p: PipelineRun; projectId: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <StatusChip status={p.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sidebar-hover text-sidebar-fg-muted">
              <GitBranch size={10} weight="bold" aria-hidden="true" />
              {p.branch}
            </span>
            <span className="text-xs font-mono text-muted tabular-nums" aria-label={`Commit ${p.commitSha}`}>
              {shortSha(p.commitSha)}
            </span>
          </div>
          <p className="text-xs text-default truncate mt-0.5">{p.commitMessage}</p>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-4 ml-4">
        {p.runId ? (
          <Link
            href={`/projects/${projectId}/runs/${p.runId}`}
            className="text-[11px] font-mono text-primary hover:text-primary-hover transition-colors"
          >
            {p.runId}
          </Link>
        ) : (
          <span className="text-[11px] text-muted">—</span>
        )}

        <div className="text-right">
          <div className="flex items-center gap-1 text-[11px] text-muted">
            <Clock size={10} weight="bold" aria-hidden="true" />
            {formatDate(p.triggeredAt)}
          </div>
          {p.finishedAt && (
            <div className="text-[11px] text-muted">{formatDate(p.finishedAt)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
