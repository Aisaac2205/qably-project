'use client'

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { PageHeader } from '@/components/ui/page-header'
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

      <PageHeader
        title={t('runs.title')}
        description={t('runs.subtitle')}
        actions={
          hasNoManualCases ? (
            <div className="flex flex-col items-end gap-1">
              <Button
                type="button"
                disabled
                focusableWhenDisabled
                aria-describedby="new-run-no-manual-hint"
                className="text-sm font-semibold"
                size="sm"
              >
                <Plus size={14} weight="bold" aria-hidden="true" />
                {t('runs.newRun')}
              </Button>
              <p id="new-run-no-manual-hint" className="text-xs text-muted max-w-[260px] text-right">
                {t('runs.noManualCasesInProject')}
              </p>
            </div>
          ) : (
            <Link
              href={`/projects/${projectId}/runs/new`}
              className={cn(buttonVariants({ size: 'sm' }), 'font-semibold')}
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              {t('runs.newRun')}
            </Link>
          )
        }
      />

      <div className="space-y-6">
        <RunList projectId={projectId} />
      </div>
    </div>
  )
}
