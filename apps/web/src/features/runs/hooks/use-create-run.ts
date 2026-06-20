'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createRun } from '@/lib/mock-store'

export function useCreateRun(projectId: string) {
  const router = useRouter()

  const create = useCallback(
    (suiteId: string, name?: string) => {
      const run = createRun({ projectId, suiteId, name })
      router.push(`/projects/${projectId}/runs/${run.id}`)
    },
    [projectId, router],
  )

  return create
}
