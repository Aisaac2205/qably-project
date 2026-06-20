'use client'

import type { Project } from '@qably/types'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { StatusChip } from './status-chip'

function healthColor(score: number): string {
  if (score >= 80) return 'bg-pass'
  if (score >= 50) return 'bg-warn'
  return 'bg-fail'
}

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-default">{project.name}</h1>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${healthColor(project.healthScore)}`}
              aria-hidden="true"
            />
            <span className="text-[11px] font-mono text-muted">
              {project.healthScore}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2">
          <StatusChip status={project.lastRunStatus} />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>
            <span className="font-semibold text-default">{project.suiteCount}</span> suites
          </span>
          <span>
            <span className="font-semibold text-default">{project.activeRunCount}</span> active runs
          </span>
          <span>
            <span className="font-semibold text-default">{project.aiPendingCount}</span> AI pending
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
