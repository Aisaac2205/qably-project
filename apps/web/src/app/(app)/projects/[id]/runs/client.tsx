'use client'

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { PageHeader } from '@/components/ui/page-header'
import { buttonVariants } from '@/components/ui/button'
import { RunList } from '@/features/runs/components/run-list'
import { CiAdapterPanel } from '@/features/runs/components/ci-adapter-panel'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/lib/use-mock-store'
import { cn } from '@/lib/utils'

export function RunListPageClient({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const project = useProject(projectId)

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
          { label: t('runs.title') },
        ]}
      />

      <PageHeader
        title={t('runs.title')}
        description={t('runs.subtitle')}
        actions={
          <Link
            href={`/projects/${projectId}/runs/new`}
            className={cn(buttonVariants({ size: 'sm' }), 'font-semibold')}
          >
            <Plus size={14} weight="bold" aria-hidden="true" />
            {t('runs.newRun')}
          </Link>
        }
      />

      <div className="space-y-6">
        <CiAdapterPanel projectId={projectId} />
        <RunList projectId={projectId} />
      </div>
    </div>
  )
}
