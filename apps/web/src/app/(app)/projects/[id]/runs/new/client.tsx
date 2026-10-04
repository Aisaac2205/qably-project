'use client'

import { NewRunAction } from '@/features/runs/components/new-run-action'

export function NewRunPageClient({
  projectId,
  initialSuiteId,
}: {
  projectId: string
  initialSuiteId?: string
}) {
  return (
    <div className="w-full px-5 py-6 sm:px-7 lg:px-9">
      <NewRunAction
        projectId={projectId}
        disabled={false}
        defaultOpen
        initialSuiteId={initialSuiteId}
      />
    </div>
  )
}
