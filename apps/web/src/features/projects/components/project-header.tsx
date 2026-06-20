'use client'

import type { Project } from '@qably/types'
import { StatusChip } from './status-chip'

function healthColor(score: number): string {
  if (score >= 80) return 'bg-pass'
  if (score >= 50) return 'bg-warn'
  return 'bg-fail'
}

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-default">{project.name}</h1>
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

      <div className="flex items-center gap-2 flex-wrap">
        <StatusChip status={project.lastRunStatus} />
      </div>

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
    </div>
  )
}
