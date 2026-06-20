'use client'

import { RunList } from '@/features/runs/components/run-list'

export function RunListPageClient({ projectId }: { projectId: string }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-default">Runs</h1>
      </div>
      <RunList projectId={projectId} />
    </div>
  )
}
