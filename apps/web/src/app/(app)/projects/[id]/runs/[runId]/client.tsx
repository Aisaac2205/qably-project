'use client'

import Link from 'next/link'
import { useRun, useProject } from '@/lib/use-mock-store'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { ArrowLeft } from '@phosphor-icons/react'
import { RunDetail } from '@/features/runs/components/run-detail'

export function RunDetailPageClient({
  projectId,
  runId,
}: {
  projectId: string
  runId: string
}) {
  const run = useRun(runId)
  const project = useProject(projectId)

  if (!run) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: 'Runs', href: `/projects/${projectId}/runs` },
            { label: 'Not found' },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-muted">Run not found</p>
          <Link
            href={`/projects/${projectId}/runs`}
            className="text-sm text-primary font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden="true" />
            Back to runs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-4">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: 'Runs', href: `/projects/${projectId}/runs` },
            { label: run.name },
          ]}
        />
      </div>
      <RunDetail projectId={projectId} run={run} />
    </div>
  )
}
