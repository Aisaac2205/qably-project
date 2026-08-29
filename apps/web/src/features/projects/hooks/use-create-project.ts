'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProject, type CreateProjectPayload } from '../api/projects.api'
import { projectKeys } from '../lib/query-keys'

export function useCreateProject() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all })
      router.push(`/projects/${project.id}`)
    },
  })
}
