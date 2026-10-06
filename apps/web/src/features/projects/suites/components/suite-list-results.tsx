'use client'

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import type { SuiteSummary } from '@qably/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { suiteNewPath } from '@/features/projects/lib/routes'
import { useSuiteSummaries } from '@/features/projects/suites/hooks/use-suite-summaries'
import {
  hasSummariesFilter,
  type SuiteSummariesFilters,
} from '@/features/projects/suites/lib/suite-summaries-query'
import { SuiteRow } from './suite-row'

const ACTION_FOCUS_RING = 'focus-visible:outline-hidden! focus-visible:ring-primary'
const ROW_LINK_CLASS =
  'block focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary forced-colors:focus-visible:-outline-offset-2!'

interface SuiteListResultsProps {
  projectId: string
  filters: SuiteSummariesFilters
  onClearFilters: () => void
}

interface SuiteRowsProps {
  projectId: string
  suites: SuiteSummary[]
}

function SuiteRows({ projectId, suites }: SuiteRowsProps) {
  const { t } = useTranslation()

  return (
    <div className="rule-bleed border-y border-border">
      <EntityList aria-label={t('suites.ariaFilterSuites')} className="divide-y divide-border">
        {suites.map((suite) => (
          <li key={suite.id}>
            <Link href={`/projects/${projectId}/suites/${suite.id}`} className={ROW_LINK_CLASS}>
              <SuiteRow suite={suite} />
            </Link>
          </li>
        ))}
      </EntityList>
    </div>
  )
}

export function SuiteListResults({ projectId, filters, onClearFilters }: SuiteListResultsProps) {
  const { t } = useTranslation()
  const { suites, isLoading, isLoadingError, isPlaceholderData, refetch } = useSuiteSummaries(
    projectId,
    filters,
  )

  function renderContent() {
    if (isLoadingError) {
      return (
        <StateView
          kind="error"
          title={t('suites.loadError')}
          focusOnMount
          action={
            <Button
              type="button"
              variant="outline"
              className={ACTION_FOCUS_RING}
              onClick={() => void refetch()}
            >
              {t('common.retry')}
            </Button>
          }
        />
      )
    }

    if (isLoading || (isPlaceholderData && suites.length === 0)) {
      return <StateView kind="loading" title={t('common.loading')} />
    }

    if (suites.length > 0) {
      return <SuiteRows projectId={projectId} suites={suites} />
    }

    if (hasSummariesFilter(filters)) {
      return (
        <StateView
          kind="empty"
          title={t('suites.noSuitesMatch')}
          action={
            <Button
              type="button"
              variant="outline"
              className={ACTION_FOCUS_RING}
              onClick={onClearFilters}
            >
              {t('suites.clearFilters')}
            </Button>
          }
        />
      )
    }

    return (
      <StateView
        kind="empty"
        title={t('suites.noSuitesHeading')}
        description={t('suites.createSuiteHint')}
        action={
          <Link
            href={suiteNewPath(projectId)}
            className={cn(buttonVariants(), ACTION_FOCUS_RING)}
          >
            <Plus size={14} weight="bold" aria-hidden="true" />
            {t('suites.newSuite')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="min-w-0" aria-busy={isPlaceholderData} data-testid="suite-list-results">
      {renderContent()}
    </div>
  )
}
