'use client'

import { useProjects } from '../hooks/use-projects'
import { ProjectCard } from './project-card'
import Link from 'next/link'
import { FolderOpen, Plus } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ProjectCardSkeleton() {
  return (
    <div
      data-slot="project-card-skeleton"
      className="flex flex-col h-52 rounded-xl bg-surface border border-border/60 p-5 shadow-card animate-pulse"
      aria-hidden="true"
    >
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-32 rounded bg-surface-hover" />
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-5 w-10 rounded-full bg-surface-hover" />
          <div className="size-6 rounded bg-surface-hover/60" />
        </div>
      </div>

      {/* Tech icons Skeleton */}
      <div className="flex-1 flex items-center justify-center gap-2.5">
        <div className="size-8 rounded-lg bg-surface-hover" />
        <div className="size-8 rounded-lg bg-surface-hover" />
        <div className="size-8 rounded-lg bg-surface-hover" />
      </div>

      {/* Footer Skeleton */}
      <div className="flex items-center gap-2 border-t border-border/40 pt-3">
        <div className="size-2 rounded-full bg-surface-hover" />
        <div className="h-3 w-40 rounded bg-surface-hover" />
      </div>
    </div>
  )
}

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
        <ProjectCardSkeleton />
        <ProjectCardSkeleton />
        <ProjectCardSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-fail/30 bg-surface/40 px-6 py-16 text-center" role="alert">
        <p className="text-sm font-medium text-fail">{t('projects.loadFailed')}</p>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface/40 px-6 py-16 text-center animate-page-enter">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border/60 bg-surface-raised text-muted shadow-2xs">
          <FolderOpen size={24} weight="duotone" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-default">
          {t('projects.noProjects')}
        </h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted">
          {t('projects.noProjectsDescription')}
        </p>
        <Link
          href="/projects/new"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
          <span>{t('projects.createFirst')}</span>
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

