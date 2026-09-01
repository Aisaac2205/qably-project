'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CaseStatus } from '@qably/types'
import { updateRunCase } from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export function useUpdateRunCase(runId: string) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ caseId, status }: { caseId: string; status: CaseStatus }) =>
      updateRunCase(runId, caseId, { status }),
    onSuccess: (run) => {
      queryClient.setQueryData(runKeys.detail(runId), run)
    },
  })

  return useCallback(
    (caseId: string, status: CaseStatus) => {
      mutation.mutate({ caseId, status })
    },
    [mutation],
  )
}
