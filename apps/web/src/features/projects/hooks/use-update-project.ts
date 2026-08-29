'use client'

import { useCallback } from 'react'
import { updateProject } from '@/lib/mock-store'
import type { Project } from '@qably/types'

export function useUpdateProject() {
  return useCallback(
    (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'connectionId' | 'technologies'>>) => {
      updateProject(id, patch)
    },
    [],
  )
}
