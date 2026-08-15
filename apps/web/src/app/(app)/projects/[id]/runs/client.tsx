'use client'

import { RunList } from '@/features/runs/components/run-list'
import { CiAdapterPanel } from '@/features/runs/components/ci-adapter-panel'
import { PageHeader } from '@/components/ui/page-header'

export function RunListPageClient({ projectId }: { projectId: string }) {
  return (
    <div className="p-4">
      <div className="mb-4"><PageHeader title="Runs" /></div>
      <CiAdapterPanel projectId={projectId} />
      <RunList projectId={projectId} />
    </div>
  )
}
