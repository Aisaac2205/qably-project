'use client'

import { useProjects } from '../hooks/use-projects'
import { ProjectCard } from './project-card'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export function ProjectGrid() {
  const { projects, isLoading, isError } = useProjects()
  const { t } = useTranslation()
  const sorted = [...projects].sort(
    (a, b) =>
      new Date(b.activity?.lastRunAt ?? b.updatedAt).getTime() -
      new Date(a.activity?.lastRunAt ?? a.updatedAt).getTime(),
  )

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-52 rounded-xl border border-border/60 bg-surface animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="py-20 text-center text-sm text-fail" role="alert">
        {t('projects.loadFailed')}
      </p>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted text-sm">{t('projects.noProjects')}</p>
        <Link
          href="/projects/new"
          className="text-primary text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('projects.createFirst')}
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
