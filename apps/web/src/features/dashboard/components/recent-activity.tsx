'use client'

import { Play, Sparkle, Code } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { StatusChip } from '@/features/projects/components/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime } from '@/features/dashboard/lib/format'

export function RecentActivity() {
  const stats = useDashboardStats()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Recent runs */}
      <section>
        <h2 className="text-lg font-medium mb-3">Recent runs</h2>
        <Card>
          {stats.recentRuns.length === 0 ? (
            <p className="text-xs text-muted p-4">No runs yet</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-2 py-2.5 px-3"
                >
                  <Play size={14} className="text-muted shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-default truncate">{run.name}</p>
                    <p className="text-[10px] text-muted truncate">{run.suiteName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted tabular-nums font-mono">
                      {formatRelativeTime(run.startedAt)}
                    </span>
                    <StatusChip status={run.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Pending AI cases */}
      <section>
        <h2 className="text-lg font-medium mb-3">Pending AI cases</h2>
        <Card>
          {stats.recentAiCases.length === 0 ? (
            <p className="text-xs text-muted p-4">No pending AI cases</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentAiCases.map((c) => (
                <div key={c.id} className="py-2.5 px-3">
                  <div className="flex items-start gap-2">
                    <Sparkle size={14} className="text-ai mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-default truncate">{c.name}</p>
                      <p className="text-[10px] text-muted font-mono truncate">
                        {c.sourceFile}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Recent pipelines */}
      <section>
        <h2 className="text-lg font-medium mb-3">Recent pipelines</h2>
        <Card>
          {stats.recentPipelines.length === 0 ? (
            <p className="text-xs text-muted p-4">No pipelines yet</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentPipelines.map((pipe) => (
                <div
                  key={pipe.id}
                  className="flex items-center gap-2 py-2.5 px-3"
                >
                  <Code size={14} className="text-muted shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-default truncate">
                      {pipe.commitMessage}
                    </p>
                    <p className="text-[10px] text-muted">
                      <span className="font-mono">{pipe.commitSha}</span>
                      {' · '}
                      {pipe.branch}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted tabular-nums font-mono">
                      {formatRelativeTime(pipe.triggeredAt)}
                    </span>
                    <StatusChip status={pipe.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
