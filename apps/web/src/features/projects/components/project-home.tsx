'use client'

import type { Project } from '@qably/types'
import { useRuns, useAiCases, usePipelines } from '@/lib/use-mock-store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProjectHeader } from './project-header'
import { StatusChip } from './status-chip'

function RecentRuns({ projectId }: { projectId: string }) {
  const runs = useRuns(projectId)
  const recent = runs.slice(0, 3)

  if (recent.length === 0) {
    return (
      <div className="text-[11px] text-muted py-3">
        No runs yet
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {recent.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-canvas transition-colors"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-default truncate">{r.name}</div>
            <div className="text-[10px] text-muted">{r.suiteName}</div>
          </div>
          <StatusChip status={r.status} />
        </div>
      ))}
    </div>
  )
}

function RecentAiCases({ projectId }: { projectId: string }) {
  const cases = useAiCases(projectId)
  const pending = cases.filter((c) => c.reviewStatus === 'pending').slice(0, 3)

  if (pending.length === 0) {
    return (
      <div className="text-[11px] text-muted py-3">
        No pending AI cases
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {pending.map((c) => (
        <div
          key={c.id}
          className="py-1.5 px-2 rounded hover:bg-canvas transition-colors"
        >
          <div className="text-xs font-medium text-default truncate">{c.name}</div>
          <div className="text-[10px] text-muted truncate">{c.sourceFile}</div>
        </div>
      ))}
    </div>
  )
}

function RecentPipelines({ projectId }: { projectId: string }) {
  const pipelines = usePipelines(projectId)
  const recent = pipelines.slice(0, 3)

  if (recent.length === 0) {
    return (
      <div className="text-[11px] text-muted py-3">
        No pipelines yet
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {recent.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-canvas transition-colors"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-default truncate">{p.commitMessage}</div>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span className="font-mono">{p.commitSha}</span>
              <span>{p.branch}</span>
            </div>
          </div>
          <StatusChip status={p.status} />
        </div>
      ))}
    </div>
  )
}

export function ProjectHome({ project }: { project: Project }) {
  return (
    <div className="space-y-6 p-4">
      <ProjectHeader project={project} />

      <section>
        <h2 className="text-lg font-medium mb-3">Recent runs</h2>
        <Card>
          <RecentRuns projectId={project.id} />
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Pending AI cases</h2>
        <Card>
          <RecentAiCases projectId={project.id} />
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent pipelines</h2>
        <Card>
          <RecentPipelines projectId={project.id} />
        </Card>
      </section>
    </div>
  )
}
