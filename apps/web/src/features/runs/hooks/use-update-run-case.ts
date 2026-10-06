'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CaseStatus } from '@qably/types'
import { markSuiteSummariesStale } from '@/features/projects/suites/lib/suite-summaries-cache'
import { updateRunCase } from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export function useUpdateRunCase(
  runId: string,
  onError?: (error: unknown) => void,
) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ caseId, status }: { caseId: string; status: CaseStatus }) =>
      updateRunCase(runId, caseId, { status }),
    onSuccess: (run) => {
      queryClient.setQueryData(runKeys.detail(runId), run)
      markSuiteSummariesStale(queryClient, run.projectId)
    },
    onError,
  })
  const { mutate } = mutation

  return useCallback(
    (caseId: string, status: CaseStatus) => {
      mutate({ caseId, status })
    },
    [mutate],
  )
}
