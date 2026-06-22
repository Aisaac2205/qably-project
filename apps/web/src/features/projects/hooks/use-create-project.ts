'use client'

import { useRouter } from 'next/navigation'
import { createProject } from '@/lib/mock-store'
import { useCallback } from 'react'

export function useCreateProject() {
  const router = useRouter()

  const create = useCallback(
    (input: { name: string; description?: string; githubRepo?: string; technologies?: string[] }) => {
      const project = createProject(input)
      router.push(`/projects/${project.id}`)
    },
    [router],
  )

  return create
}
