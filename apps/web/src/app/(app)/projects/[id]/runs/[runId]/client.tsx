'use client'

import Link from 'next/link'
import { useRun } from '@/lib/use-mock-store'
import { useProject } from '@/features/projects/hooks/use-project'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { ArrowLeft } from '@phosphor-icons/react'
import { RunDetail } from '@/features/runs/components/run-detail'
import { useTranslation } from '@/lib/i18n'

export function RunDetailPageClient({
  projectId,
  runId,
}: {
  projectId: string
  runId: string
}) {
  const { t } = useTranslation()
  const run = useRun(runId)
  const { project } = useProject(projectId)

  if (!run) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
        <Breadcrumbs
          items={[
            { label: t('suites.breadcrumbProjects'), href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: t('runs.title'), href: `/projects/${projectId}/runs` },
            { label: t('common.notFound') },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-muted">{t('common.notFound')}</p>
          <Link
            href={`/projects/${projectId}/runs`}
            className="text-sm text-primary font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden="true" />
            {t('runs.title')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
          { label: t('runs.title'), href: `/projects/${projectId}/runs` },
          { label: run.name },
        ]}
      />
      <RunDetail projectId={projectId} run={run} />
    </div>
  )
}
