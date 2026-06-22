'use client'

import Link from 'next/link'
import type { Project, RunStatus } from '@qably/types'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { formatRelativeTime } from '@/features/dashboard/lib/format'

interface ProjectHealthCardProps {
  project: Project
  lastRunStatus: RunStatus
  lastRunAt: string
  suiteCount: number
  aiPendingCount: number
}

export function ProjectHealthCard({
  project,
  lastRunStatus,
  lastRunAt,
  suiteCount,
  aiPendingCount,
}: ProjectHealthCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <Link
          href={`/projects/${project.id}`}
          className="hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
        >
          <CardTitle className="text-base">{project.name}</CardTitle>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <StatusChip status={lastRunStatus} />
          <span className="text-xs text-muted">
            <span className="font-semibold text-default tabular-nums font-mono">
              {project.healthScore}%
            </span>{' '}
            health
          </span>
        </div>
        <p className="text-xs text-muted">
          Last run {formatRelativeTime(lastRunAt)}
        </p>
      </CardContent>
      <CardFooter className="flex items-center gap-3 text-xs text-muted">
        <span>
          <span className="font-semibold text-default">{suiteCount}</span> suites
        </span>
        <span>
          <span className="font-semibold text-default">{aiPendingCount}</span> AI pending
        </span>
        <Link
          href={`/projects/${project.id}`}
          className="ml-auto text-xs text-primary hover:text-primary-hover transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
        >
          View
        </Link>
      </CardFooter>
    </Card>
  )
}
