'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react'
import type { CiRunDetailRecord } from '@qably/types'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { buttonVariants } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'
import { CiRunDetail } from '@/features/runs/components/ci-run-detail'
import { useCiRunLabel } from '@/features/runs/hooks/use-ci-run-label'
import { useCiRun } from '@/features/runs/hooks/use-ci-runs'
import { useProject } from '@/features/projects/hooks/use-project'
import { projectRootPath } from '@/features/projects/lib/routes'
import { ApiError } from '@/lib/api-client'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const PAGE_CLASS = 'w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter'

function PageFrame({
  projectId,
  current,
  children,
}: {
  projectId: string
  current: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { project } = useProject(projectId)

  return (
    <div className={PAGE_CLASS}>
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('runs.title'), href: `/projects/${projectId}/runs` },
          { label: current },
        ]}
      />
      <h1 className="sr-only">{current}</h1>
      {children}
    </div>
  )
}

function BackToRuns({ projectId }: { projectId: string }) {
  const { t } = useTranslation()

  return (
    <Link
      href={`/projects/${projectId}/runs?tab=actions`}
      className={cn(
        buttonVariants({ variant: 'outline' }),
        'focus-visible:outline-hidden! focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <ArrowLeft size={16} weight="bold" aria-hidden="true" />
      {t('runs.ci.backToList')}
    </Link>
  )
}

function Unavailable({ projectId, notFound }: { projectId: string; notFound: boolean }) {
  const { t } = useTranslation()
  const title = t(notFound ? 'runs.ci.notFoundTitle' : 'runs.ci.detailErrorTitle')
  const description = t(notFound ? 'runs.ci.notFoundDescription' : 'runs.ci.detailErrorDescription')

  return (
    <PageFrame projectId={projectId} current={title}>
      <StateView
        kind={notFound ? 'empty' : 'error'}
        title={title}
        description={description}
        action={<BackToRuns projectId={projectId} />}
      />
    </PageFrame>
  )
}

function CiRunPage({ projectId, ciRun }: { projectId: string; ciRun: CiRunDetailRecord }) {
  const label = useCiRunLabel(ciRun)

  return (
    <PageFrame projectId={projectId} current={label}>
      <CiRunDetail projectId={projectId} ciRun={ciRun} />
    </PageFrame>
  )
}

export function CiRunDetailPageClient({
  projectId,
  ciRunId,
}: {
  projectId: string
  ciRunId: string
}) {
  const { t } = useTranslation()
  const { ciRun, isLoading, error } = useCiRun(ciRunId)

  if (isLoading) {
    return (
      <div className={PAGE_CLASS}>
        <StateView kind="loading" title={t('runs.ci.detailLoading')} />
      </div>
    )
  }

  if (ciRun?.projectId === projectId) {
    return <CiRunPage projectId={projectId} ciRun={ciRun} />
  }

  const notFound = ciRun !== undefined || (error instanceof ApiError && error.status === 404)

  return <Unavailable projectId={projectId} notFound={notFound} />
}
