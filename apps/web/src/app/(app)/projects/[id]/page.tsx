'use client'

import { use } from 'react'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { useProject } from '@/lib/use-mock-store'
import { ProjectHome } from '@/features/projects/components/project-home'

type Params = Promise<{ id: string }>

export default function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = use(params)
  const project = useProject(id)

  if (!project) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
        <Breadcrumbs items={[{ label: 'Projects', href: '/projects' }, { label: 'Not found' }]} />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-muted text-sm">Project not found</p>
          <Link
            href="/projects"
            className="text-primary text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
      />
      <ProjectHome project={project} />
    </div>
  )
}
