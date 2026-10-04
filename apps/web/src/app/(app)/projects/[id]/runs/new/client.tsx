'use client'

import { RunListPageClient } from '../client'

export function NewRunPageClient({
  projectId,
  initialSuiteId,
}: {
  projectId: string
  initialSuiteId?: string
}) {
  return (
    <RunListPageClient
      projectId={projectId}
      initialTab="manual"
      openNewRun
      initialSuiteId={initialSuiteId}
    />
  )
}
