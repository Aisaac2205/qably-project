'use client'

import { useCallback } from 'react'
import { updateRunCaseStatus } from '@/lib/mock-store'
import type { CaseStatus } from '@qably/types'

export function useUpdateRunCase(runId: string) {
  const update = useCallback(
    (caseId: string, status: CaseStatus) => {
      updateRunCaseStatus(runId, caseId, status)
    },
    [runId],
  )
  return update
}
