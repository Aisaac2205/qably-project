'use client'

/**
 * ProjectHome — `/projects/[id]/`.
 *
 * Thin shell. Just the project name + description + the suite list.
 * No KPI strip, no activity feed, no "Recent X" cards — those live in
 * the central `/dashboard` and in the dedicated `/runs` and
 * `/ai-review` pages, not here.
 */
import { SuiteList } from '@/features/suites/components/suite-list'
import type { Project } from '@qably/types'

export function ProjectHome({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-default text-wrap-balance">
          {project.name}
        </h1>
        {project.description && (
          <p className="text-sm text-muted mt-1 max-w-[65ch] text-wrap-pretty">
            {project.description}
          </p>
        )}
      </header>
      <SuiteList projectId={project.id} />
    </div>
  )
}
