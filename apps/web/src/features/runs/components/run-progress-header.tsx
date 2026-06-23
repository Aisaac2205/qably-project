'use client'

import type { Run } from '@qably/types'
import { GitCommit } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  api: 'API',
  github_actions: 'CI',
}

export function RunProgressHeader({ run }: { run: Run }) {
  const passRateDisplay = `${run.passRate}%`
  const sourceLabel = SOURCE_LABELS[run.source] ?? run.source

  return (
    <Card className="rounded-none border-x-0 border-t-0">
      <CardHeader className="flex-row items-center justify-between gap-4 py-4">
        <div className="min-w-0 flex items-center gap-3">
          <StatusChip status={run.status} />
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base font-semibold text-default truncate">
              {run.name}
            </CardTitle>
            <CardDescription className="text-xs text-muted truncate">
              {run.suiteName}
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted">Pass rate</div>
            <div className="text-base font-mono font-semibold tabular-nums text-default">
              {passRateDisplay}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted">Source</div>
            <div className="text-sm font-semibold text-default">{sourceLabel}</div>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted">Started</div>
            <div className="text-sm text-default">{formatDate(run.startedAt)}</div>
          </div>
          {run.finishedAt && (
            <div className="hidden sm:block text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted">Finished</div>
              <div className="text-sm text-default">{formatDate(run.finishedAt)}</div>
            </div>
          )}
        </div>
      </CardHeader>

      {/* CI commit info — only shown when run has commit metadata */}
      {run.source === 'github_actions' && run.commitSha && (
        <CardContent className="pb-4 -mt-2">
          <div
            className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-canvas border border-border text-sm"
            data-testid="run-commit-info"
          >
            <GitCommit
              size={16}
              weight="duotone"
              className="text-muted shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              {run.commitMessage && (
                <p className="text-default text-wrap-pretty line-clamp-2">
                  {run.commitMessage}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="font-mono">{run.commitSha.slice(0, 7)}</span>
                {run.branch && <span>on <span className="font-mono">{run.branch}</span></span>}
                {run.commitAuthor && (
                  <span>
                    by <span className="text-default">{run.commitAuthor.name}</span>
                  </span>
                )}
                {run.workflowName && <span>via {run.workflowName}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
