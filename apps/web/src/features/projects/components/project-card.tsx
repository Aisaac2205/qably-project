'use client'

import Link from 'next/link'
import type { Project } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { StatusChip } from './status-chip'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Card className="hover:border-primary transition-colors">
        <CardContent className="p-3">
          <div className="text-base font-medium text-default truncate mb-1">
            {project.name}
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {project.description}
            </p>
          )}

          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={project.lastRunStatus} />
            <span className="text-xs font-mono text-muted-foreground">
              {project.healthScore}%
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
        </CardContent>
      </Card>
    </Link>
  )
}
