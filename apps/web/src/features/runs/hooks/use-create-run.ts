'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRun } from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export function useCreateRun(projectId: string) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ suiteId, name }: { suiteId: string; name?: string }) =>
      createRun({ projectId, suiteId, name }),
    onSuccess: async (run) => {
      queryClient.setQueryData(runKeys.detail(run.id), run)
      await queryClient.invalidateQueries({ queryKey: runKeys.all })
      router.push(`/projects/${projectId}/runs/${run.id}`)
    },
  })

  return useCallback(
    (suiteId: string, name?: string) => {
      mutation.mutate({ suiteId, name })
    },
    [mutation],
  )
}
