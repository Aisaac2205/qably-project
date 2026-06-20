'use client'

import { ProjectGrid } from '@/features/projects/components/project-grid'

export default function ProjectsListPage() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-default">Projects</h1>
      </div>
      <ProjectGrid />
    </div>
  )
}
