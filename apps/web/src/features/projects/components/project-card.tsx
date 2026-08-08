'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react'
import type { Project } from '@qably/types'
import { StatusChip } from './status-chip'
import { TechBadge } from './tech-badge'
import { EditProjectDialog } from './edit-project-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useProjectAggregate } from '../lib/aggregate'
import { TECH_ICONS, type TechKey } from '../lib/tech-icons'
import { useTranslation } from '@/lib/i18n'

const MAX_ICONS = 4

export function ProjectCard({ project }: { project: Project }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { t } = useTranslation()
  const { delete: deleteProject } = useProjectAggregate()

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
    <div className="group relative flex flex-col h-52 rounded-xl bg-surface border border-border/80 p-5 hover:border-primary/40 hover:shadow-card transition-shadow duration-200 focus-within:border-primary/40">
      <Link
        href={`/projects/${project.id}`}
        className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={project.name}
      />

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
          <Menu>
            <MenuTrigger
              aria-label={t('projects.projectActions')}
              className="relative z-10 opacity-0 group-hover:opacity-100 size-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-default hover:bg-surface-hover transition-colors focus-visible:opacity-100 data-[popup-open]:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <DotsThreeVertical size={14} weight="bold" aria-hidden="true" />
            </MenuTrigger>
            <MenuPortal>
              <MenuPositioner align="end">
                <MenuContent>
                  <MenuItem onClick={() => setEditOpen(true)}>
                    <PencilSimple size={14} aria-hidden="true" />
                    {t('projects.editProject')}
                  </MenuItem>
                  <MenuItem
                    onClick={() => setDeleteOpen(true)}
                    className="text-fail data-[highlighted]:bg-fail-bg data-[highlighted]:text-fail"
                  >
                    <Trash size={14} aria-hidden="true" />
                    {t('projects.deleteProject')}
                  </MenuItem>
                </MenuContent>
              </MenuPositioner>
            </MenuPortal>
          </Menu>
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
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
        <span className="text-xs text-muted-foreground">
          {t('projects.production')} · {passedCount}/{project.suiteCount} {project.suiteCount === 1 ? t('projects.service_one') : t('projects.service_other')} {t('projects.online')}
        </span>
      </div>

      {/* Screen-reader summary for tests and SR users */}
      <div className="sr-only">
        <StatusChip status={project.lastRunStatus} />
        <span><span>{project.suiteCount}</span>{t('projects.suitesSuffix')}</span>
        <span><span>{project.activeRunCount}</span>{t('projects.activeSuffix')}</span>
        <span><span>{project.aiPendingCount}</span>{t('projects.aiPendingSuffix')}</span>
      </div>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('projects.deleteProjectTitle')}
        description={t('projects.deleteProjectDescription', { name: project.name })}
        onConfirm={() => deleteProject(project.id)}
      />
    </div>
  )
}
