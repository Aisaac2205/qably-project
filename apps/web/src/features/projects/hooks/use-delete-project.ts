'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteProject } from '../api/projects.api'
import { projectKeys } from '../lib/query-keys'

export function useDeleteProject() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })

  return {
    remove: (id: string) => mutation.mutate(id),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
