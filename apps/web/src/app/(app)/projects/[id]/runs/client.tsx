'use client'

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Button, buttonVariants } from '@/components/ui/button'
import { RunList } from '@/features/runs/components/run-list'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/features/projects/hooks/use-project'
import { cn } from '@/lib/utils'
import { projectRootPath } from '@/features/projects/lib/routes'

export function RunListPageClient({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { project } = useProject(projectId)
  const hasNoManualCases = project?.hasManualCases === false

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('runs.title') },
        ]}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">{t('runs.title')}</h1>
          <p className="text-sm text-muted">{t('runs.subtitle')}</p>
        </div>
        {hasNoManualCases ? (
          <div className="flex flex-col md:items-end gap-1 w-full md:w-auto">
            <Button
              type="button"
              disabled
              focusableWhenDisabled
              aria-describedby="new-run-no-manual-hint"
              className="h-11 w-full px-4 text-sm md:h-10 md:w-auto"
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              {t('runs.newRun')}
            </Button>
            <p id="new-run-no-manual-hint" className="text-xs text-muted max-w-[260px] text-left md:text-right">
              {t('runs.noManualCasesInProject')}
            </p>
          </div>
        ) : (
          <Link
            href={`/projects/${projectId}/runs/new`}
            className={cn(buttonVariants(), 'h-11 w-full px-4 text-sm md:h-10 md:w-auto')}
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            {t('runs.newRun')}
          </Link>
        )}
      </div>

      <div className="space-y-6">
        <RunList projectId={projectId} />
      </div>
    </div>
  )
}
