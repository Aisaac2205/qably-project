'use client'

import Link from 'next/link'
import type { Project } from '@qably/types'
import { StatusChip } from './status-chip'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block bg-surface rounded-md border border-border hover:border-primary transition-colors p-3 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="text-sm font-semibold text-default truncate mb-1">
        {project.name}
      </div>
      {project.description && (
        <p className="text-[11px] text-muted line-clamp-2 mb-2">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-2 mb-2">
        <StatusChip status={project.lastRunStatus} />
        <span className="text-[10px] font-mono text-muted">
          {project.healthScore}%
        </span>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span>
          <span className="font-semibold text-default">{project.suiteCount}</span> suites
        </span>
        <span>
          <span className="font-semibold text-default">{project.activeRunCount}</span> active
        </span>
        <span>
          <span className="font-semibold text-default">{project.aiPendingCount}</span> AI pending
        </span>
      </div>
    </Link>
  )
}
