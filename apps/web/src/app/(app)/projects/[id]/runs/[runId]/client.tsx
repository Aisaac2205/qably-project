'use client'

import { useRun } from '@/lib/use-mock-store'
import { RunDetail } from '@/features/runs/components/run-detail'

export function RunDetailPageClient({
  projectId,
  runId,
}: {
  projectId: string
  runId: string
}) {
  const run = useRun(runId)

  if (!run) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted">
        Run not found
      </div>
    )
  }

  return <RunDetail projectId={projectId} run={run} />
}
