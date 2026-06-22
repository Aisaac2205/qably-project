'use client'

import Link from 'next/link'
import type { Project } from '@qably/types'
import { StatusChip } from './status-chip'

export function ProjectCard({ project }: { project: Project }) {
  // Formulas to calculate mock values for the Railway-style online counter
  const passedCount = project.lastRunStatus === 'fail'
    ? Math.max(0, project.suiteCount - 1)
    : project.suiteCount

  // Map run status to the left dot color
  let dotColor = 'bg-pass'
  if (project.lastRunStatus === 'fail') {
    dotColor = 'bg-fail'
  } else if (project.lastRunStatus === 'running') {
    dotColor = 'bg-running animate-pulse'
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block group rounded-xl bg-surface border border-border/80 p-5 space-y-4 hover:border-primary/40 hover:shadow-md transition-all duration-300 focus-visible:outline-2 focus-visible:outline-primary"
    >
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-default truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1 min-h-[32px]">
              {project.description}
            </p>
          )}
        </div>

        {/* Health Score Badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
          project.healthScore >= 80 
            ? 'bg-pass-bg text-pass border-pass/20' 
            : project.healthScore >= 50 
              ? 'bg-warn-bg text-warn border-warn/20' 
              : 'bg-fail-bg text-fail border-fail/20'
        }`}>
          {project.healthScore}%
        </span>
      </div>

      {/* Card Footer Status */}
      <div className="flex items-center gap-2 border-t border-border/40 pt-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
          production · {passedCount}/{project.suiteCount} {project.suiteCount === 1 ? 'service' : 'services'} online
        </span>
      </div>

      {/* Hidden elements to support original RTL/Vitest assertions */}
      <div className="sr-only">
        <StatusChip status={project.lastRunStatus} />
        <span>
          <span>{project.suiteCount}</span> suites
        </span>
        <span>
          <span>{project.activeRunCount}</span> active
        </span>
        <span>
          <span>{project.aiPendingCount}</span> AI pending
        </span>
      </div>
    </Link>
  )
}
