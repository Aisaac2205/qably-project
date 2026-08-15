'use client'

/**
 * ProjectHome — `/projects/[id]/`.
 *
 * Thin shell. Just the project name + description + the suite list.
 * No KPI strip, no activity feed, no "Recent X" cards — those live in
 * the central `/dashboard` and in the dedicated `/runs` and
 * `/ai-review` pages, not here.
 */
import { SuiteList } from '@/features/projects/suites/components/suite-list'
import type { Project } from '@qably/types'
import { PageHeader } from '@/components/ui/page-header'

export function ProjectHome({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={project.description} />
      <SuiteList projectId={project.id} />
    </div>
  )
}
