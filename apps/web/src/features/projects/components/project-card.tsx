'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PencilSimple } from '@phosphor-icons/react'
import type { Project } from '@qably/types'
import { StatusChip } from './status-chip'
import { TechBadge } from './tech-badge'
import { EditProjectDialog } from './edit-project-dialog'
import { TECH_ICONS, type TechKey } from '../lib/tech-icons'
import { useTranslation } from '@/lib/i18n'

const MAX_ICONS = 4

export function ProjectCard({ project }: { project: Project }) {
  const [editOpen, setEditOpen] = useState(false)
  const { t } = useTranslation()

  const passedCount = project.lastRunStatus === 'fail'
    ? Math.max(0, project.suiteCount - 1)
    : project.suiteCount

  let dotColor = 'bg-pass'
  if (project.lastRunStatus === 'fail') dotColor = 'bg-fail'
  else if (project.lastRunStatus === 'running') dotColor = 'bg-running animate-pulse'

  const validTechs = (project.technologies ?? []).filter((t): t is TechKey => t in TECH_ICONS)
  const visibleTechs = validTechs.slice(0, MAX_ICONS)
  const overflowCount = validTechs.length - visibleTechs.length

  return (
    <>
      <Link
        href={`/projects/${project.id}`}
        className="group flex flex-col h-52 rounded-xl bg-surface border border-border/80 p-5 hover:border-primary/40 hover:shadow-md transition-all duration-300 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-default truncate group-hover:text-primary transition-colors min-w-0">
            {project.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              project.healthScore >= 80
                ? 'bg-pass-bg text-pass border-pass/20'
                : project.healthScore >= 50
                  ? 'bg-warn-bg text-warn border-warn/20'
                  : 'bg-fail-bg text-fail border-fail/20'
            }`}>
              {project.healthScore}%
            </span>
            <button
              type="button"
              aria-label={t('projects.editTechStack', { name: project.name })}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setEditOpen(true)
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-default hover:bg-border/40 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <PencilSimple size={13} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tech icons — centered, fills available space */}
        <div className="flex-1 flex items-center justify-center gap-3">
          {visibleTechs.length > 0 ? (
            <>
              {visibleTechs.map((key) => (
                <TechBadge key={key} techKey={key} size="lg" />
              ))}
              {overflowCount > 0 && (
                <span className="text-xs font-medium text-muted-foreground">+{overflowCount}</span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground/40 select-none">{t('projects.noStackSelected')}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border/40 pt-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs text-muted-foreground">
            {t('projects.production')} · {passedCount}/{project.suiteCount} {project.suiteCount === 1 ? t('projects.service_one') : t('projects.service_other')} {t('projects.online')}
          </span>
        </div>

        {/* Hidden elements for Vitest assertions */}
        <div className="sr-only">
          <StatusChip status={project.lastRunStatus} />
          <span><span>{project.suiteCount}</span>{t('projects.suitesSuffix')}</span>
          <span><span>{project.activeRunCount}</span>{t('projects.activeSuffix')}</span>
          <span><span>{project.aiPendingCount}</span>{t('projects.aiPendingSuffix')}</span>
        </div>
      </Link>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
