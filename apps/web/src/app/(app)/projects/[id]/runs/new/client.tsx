'use client'

import { NewRunForm } from '@/features/runs/components/new-run-form'

export function NewRunPageClient({
  projectId,
  initialSuiteId,
}: {
  projectId: string
  initialSuiteId?: string
}) {
  return <NewRunForm projectId={projectId} initialSuiteId={initialSuiteId} />
}
