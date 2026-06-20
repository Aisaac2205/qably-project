'use client'

import type { Run } from '@qably/types'
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

export function RunProgressHeader({ run }: { run: Run }) {
  const passRateDisplay = `${run.passRate}%`

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-border">
      <div className="min-w-0 flex items-center gap-3">
        <StatusChip status={run.status} />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-default truncate">{run.name}</h2>
          <p className="text-[11px] text-muted truncate">{run.suiteName}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="text-xs text-muted">Pass rate</div>
          <div className="text-sm font-semibold tabular-nums font-mono text-default">
            {passRateDisplay}
          </div>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sidebar-hover text-sidebar-fg-muted uppercase">
          {run.source}
        </span>
        <div className="text-right">
          <div className="text-[11px] text-muted">
            Started {formatDate(run.startedAt)}
          </div>
          {run.finishedAt && (
            <div className="text-[11px] text-muted">
              Finished {formatDate(run.finishedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
