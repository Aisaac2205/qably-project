'use client'

import { useProjects } from '@/features/projects/hooks/use-projects'
import { ProjectGrid } from '@/features/projects/components/project-grid'
import Link from 'next/link'
import { Plus, CaretDown, SquaresFour, List } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export default function ProjectsListPage() {
  const { projects, isLoading } = useProjects()
  const { t } = useTranslation()

  const hasProjects = projects.length > 0

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <h1 className="sr-only">{t('projects.title')}</h1>

      {/* Top Header Row with Actions & Controls (Rendered when projects exist or loading) */}
      {(isLoading || hasProjects) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 text-sm">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <span className="inline-block h-4 w-20 rounded bg-surface-hover animate-pulse" aria-hidden="true" />
            ) : (
              <span className="font-semibold text-muted-foreground">
                {projects.length} {projects.length === 1 ? t('projects.project_one') : t('projects.project_other')}
              </span>
            )}
            <span className="text-border">|</span>
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-default transition-colors font-medium cursor-pointer">
              <span>{t('projects.sortByRecent')}</span>
              <CaretDown size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground border border-border/80 rounded-lg p-0.5 bg-surface shadow-2xs">
              <button 
                className="p-1.5 rounded-md bg-zinc-100 text-default hover:text-default transition-colors cursor-pointer"
                aria-label={t('projects.gridView')}
              >
                <SquaresFour size={16} weight="fill" />
              </button>
              <button 
                className="p-1.5 rounded-md hover:bg-zinc-50 hover:text-default transition-colors cursor-pointer"
                aria-label={t('projects.listView')}
              >
                <List size={16} />
              </button>
            </div>

            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-primary-fg font-semibold px-4 py-2 text-sm rounded-lg transition-colors shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <Plus size={16} weight="bold" />
              <span>{t('projects.newButton')}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Grid / Empty State Content */}
      <ProjectGrid />
    </div>
  )
}



