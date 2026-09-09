'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProject } from '@/features/projects/api/projects.api'
import { projectKeys } from '../../lib/query-keys'

export function useUpdateTestFilePatterns(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (testFilePatterns: string[]) =>
      updateProject(projectId, { testFilePatterns }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectKeys.repository(projectId),
      })
    },
  })
}
