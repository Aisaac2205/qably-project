import type { ReactNode } from 'react'
import { ProjectProvider } from '@/features/projects/context/project-context'
import { getProject } from '@/lib/mock-store'

type Params = Promise<{ id: string }>

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Params
  children: ReactNode
}) {
  const { id } = await params
  const project = getProject(id)

  return (
    <ProjectProvider projectId={id} project={project}>
      {children}
    </ProjectProvider>
  )
}
