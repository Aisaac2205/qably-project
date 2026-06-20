'use client'

import { useProjects } from '@/lib/use-mock-store'
import { ProjectCard } from './project-card'
import Link from 'next/link'

export function ProjectGrid() {
  const projects = useProjects()
  const sorted = [...projects].sort(
    (a, b) => new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted text-sm">No projects yet</p>
        <Link
          href="/projects/new"
          className="text-primary text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Create your first project
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {sorted.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
