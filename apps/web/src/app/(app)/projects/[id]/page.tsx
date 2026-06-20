'use client'

import { useProject } from '@/lib/use-mock-store'
import { use } from 'react'
import { ProjectHome } from '@/features/projects/components/project-home'
import Link from 'next/link'

type Params = Promise<{ id: string }>

export default function ProjectDetailPage({ params }: { params: Params }) {
  // eslint hasNext.js 16: params is Promise, use use() in Client Component
  const { id } = use(params)
  const project = useProject(id)

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted text-sm">Project not found</p>
        <Link
          href="/projects"
          className="text-primary text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Back to projects
        </Link>
      </div>
    )
  }

  return <ProjectHome project={project} />
}
