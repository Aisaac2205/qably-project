'use client'

import type { CiRunSummaryRecord } from '@qably/types'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { docsUrl } from '@/lib/docs-url'
import { useTranslation } from '@/lib/i18n'
import { useCiRunsPage } from '../hooks/use-ci-runs'
import { FRESHNESS_TICK_MS, useNow } from '../hooks/use-now'
import { CiRunRow } from './ci-run-row'

const REPORT_CI_ANCHOR = 'step-4-report-ci'

function CiRunRows({ ciRuns, projectId }: { ciRuns: CiRunSummaryRecord[]; projectId: string }) {
  const { t } = useTranslation()
  const now = useNow(FRESHNESS_TICK_MS)

  return (
    <div className="rule-bleed !px-0 border-y border-border">
      <EntityList aria-label={t('runs.ci.listAria')}>
        {ciRuns.map((ciRun) => (
          <li key={ciRun.id}>
            <CiRunRow ciRun={ciRun} projectId={projectId} now={now} />
          </li>
        ))}
      </EntityList>
    </div>
  )
}

export function CiRunList({ projectId }: { projectId: string }) {
  const { t, locale } = useTranslation()
  const { ciRuns, isLoading, isError } = useCiRunsPage(projectId)

  if (ciRuns.length > 0) return <CiRunRows ciRuns={ciRuns} projectId={projectId} />

  if (isLoading) return <StateView kind="loading" title={t('runs.ci.loading')} />

  if (isError) {
    return (
      <StateView
        kind="error"
        title={t('runs.ci.errorTitle')}
        description={t('runs.ci.errorDescription')}
      />
    )
  }

  return (
    <StateView
      kind="empty"
      title={t('runs.ci.emptyTitle')}
      description={t('runs.ci.emptyDescription')}
      action={
        <a
          href={docsUrl(REPORT_CI_ANCHOR, locale)}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary md:min-h-8"
        >
          {t('runs.ci.emptyDocsLink')}
        </a>
      }
    />
  )
}
