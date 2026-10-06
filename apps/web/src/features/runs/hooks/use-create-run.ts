'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateSuiteSummaries } from '@/features/projects/suites/lib/suite-summaries-cache'
import { createRun } from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export function useCreateRun(projectId: string, options: { replaceOnCreate?: boolean } = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { replaceOnCreate = false } = options

  const mutation = useMutation({
    mutationFn: ({ suiteId, name }: { suiteId: string; name?: string }) =>
      createRun({ projectId, suiteId, name }),
    onSuccess: async (run) => {
      queryClient.setQueryData(runKeys.detail(run.id), run)
      void invalidateSuiteSummaries(queryClient, projectId)
      await queryClient.invalidateQueries({ queryKey: runKeys.all })
      const href = `/projects/${projectId}/runs/${run.id}`

      if (replaceOnCreate) {
        router.replace(href)
        return
      }

      router.push(href)
    },
  })
  const { mutate } = mutation

  const start = useCallback(
    (suiteId: string, name?: string) => {
      mutate({ suiteId, name })
    },
    [mutate],
  )

  return useMemo(
    () => ({ start, error: mutation.error }),
    [start, mutation.error],
  )
}
