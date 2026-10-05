'use client'

import Link from 'next/link'
import { useRun } from '@/features/runs/hooks/use-runs'
import { useCiRun } from '@/features/runs/hooks/use-ci-runs'
import { useCiRunLabel } from '@/features/runs/hooks/use-ci-run-label'
import { useProject } from '@/features/projects/hooks/use-project'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'
import { runTitleParts } from '@/features/runs/lib/format'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { BackButton } from '@/components/ui/back-button'
import { ArrowLeft } from '@phosphor-icons/react'
import { RunDetail } from '@/features/runs/components/run-detail'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { projectCiRunPath, projectRootPath, projectRunsPath } from '@/features/projects/lib/routes'
import { useGoBack } from '@/hooks/use-go-back'

export function RunDetailPageClient({
  projectId,
  runId,
}: {
  projectId: string
  runId: string
}) {
  const { t } = useTranslation()
  const { run, isLoading } = useRun(runId)
  const { project } = useProject(projectId)
  const { suite } = useSuite(run?.suiteId ?? '')
  const { ciRun } = useCiRun(run?.ciRunId)
  const ciRunLabel = useCiRunLabel(ciRun)
  const runsHref = run?.ciRunId ? projectRunsPath(projectId) : projectRunsPath(projectId, 'manual')
  const goBack = useGoBack(
    run?.ciRunId ? projectCiRunPath(projectId, run.ciRunId) : projectRunsPath(projectId, 'manual'),
  )

  if (isLoading) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
        <StateView kind="loading" title={t('runs.loading')} />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
        <Breadcrumbs
          items={[
            { label: t('suites.breadcrumbProjects'), href: '/projects' },
            ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
            { label: t('runs.title'), href: runsHref },
            { label: t('common.notFound') },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-muted">{t('common.notFound')}</p>
          <Link
            href={runsHref}
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
      <div className="flex min-w-0 items-center gap-1.5">
        <BackButton onClick={goBack} />
        <Breadcrumbs
          className="hidden md:flex"
          items={[
            { label: t('suites.breadcrumbProjects'), href: '/projects' },
            ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
            { label: t('runs.title'), href: runsHref },
            ...(ciRunLabel !== undefined
              ? [{ label: ciRunLabel, href: `/projects/${projectId}/runs/ci/${run.ciRunId}` }]
              : []),
            { label: runTitleParts(run, suite?.name ?? '').title },
          ]}
        />
      </div>
      <RunDetail projectId={projectId} run={run} />
    </div>
  )
}
