'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProject, type UpdateProjectPayload } from '../api/projects.api'
import { projectKeys } from '../lib/query-keys'

export function useUpdateProject() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: UpdateProjectPayload
    }) => updateProject(id, patch),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all })
      await queryClient.invalidateQueries({
        queryKey: projectKeys.detail(project.id),
      })
    },
  })

  return {
    update: (id: string, patch: UpdateProjectPayload) =>
      mutation.mutate({ id, patch }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
