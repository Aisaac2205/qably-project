import type { ReactNode } from 'react'
import { ProjectProvider } from '@/features/projects/context/project-context'

type Params = Promise<{ id: string }>

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Params
  children: ReactNode
}) {
  const { id } = await params

  return (
    <ProjectProvider projectId={id}>
      {children}
    </ProjectProvider>
  )
}
