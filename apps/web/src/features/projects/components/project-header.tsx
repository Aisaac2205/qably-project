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
    <header>
      <h1 className="text-2xl font-semibold tracking-tight text-default text-wrap-balance">
        {project.name}
      </h1>
      {project.description && (
        <p className="text-sm text-muted mt-1 max-w-[65ch] text-wrap-pretty">
          {project.description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${healthColor(project.healthScore)}`}
            aria-hidden="true"
          />
          <span className="text-[11px] font-mono text-muted">
            Health {project.healthScore}%
          </span>
        </div>
        <StatusChip status={project.lastRunStatus} />
      </div>
    </header>
  )
}
