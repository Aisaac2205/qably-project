'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Project } from '@qably/types'

interface ProjectContextValue {
  projectId: string
  project: Project | undefined
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({
  projectId,
  project,
  children,
}: {
  projectId: string
  project: Project | undefined
  children: ReactNode
}) {
  return (
    <ProjectContext.Provider value={{ projectId, project }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error('useProjectContext must be used within a ProjectProvider')
  }
  return ctx
}
