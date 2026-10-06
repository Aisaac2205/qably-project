'use client'

import type { RefObject } from 'react'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import type { SuiteSummary } from '@qably/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { EntityList } from '@/components/ui/entity-list'
import { LoadMore } from '@/components/ui/load-more'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { suiteNewPath } from '@/features/projects/lib/routes'
import { useLoadMoreFocus } from '@/features/projects/suites/hooks/use-load-more-focus'
import { useResultsAnnouncement } from '@/features/projects/suites/hooks/use-results-announcement'
import { useSpokenMessage } from '@/features/projects/suites/hooks/use-spoken-message'
import { useSuiteSummaries } from '@/features/projects/suites/hooks/use-suite-summaries'
import {
  hasSummariesFilter,
  toSuiteSummariesQuery,
  type SuiteSummariesFilters,
} from '@/features/projects/suites/lib/suite-summaries-query'
import { SuiteListError } from './suite-list-error'
import { SuiteRow } from './suite-row'

const ACTION_FOCUS_RING = 'focus-visible:outline-hidden! focus-visible:ring-primary'
const ROW_LINK_CLASS =
  'block transition-colors hover:bg-surface-hover/60 focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary forced-colors:focus-visible:-outline-offset-2!'

interface SuiteListResultsProps {
  projectId: string
  filters: SuiteSummariesFilters
  focusRegion: RefObject<HTMLElement | null>
  onClearFilters: () => void
}

interface SuiteRowsProps {
  projectId: string
  suites: SuiteSummary[]
  listProps: ReturnType<typeof useLoadMoreFocus>['listProps']
}

function SuiteRows({ projectId, suites, listProps }: SuiteRowsProps) {
  const { t } = useTranslation()

  return (
    <div className="rule-bleed border-y border-border">
      <EntityList
        {...listProps}
        aria-label={t('suites.suitesLabel')}
        className="divide-y divide-border"
      >
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

export function SuiteListResults({
  projectId,
  filters,
  focusRegion,
  onClearFilters,
}: SuiteListResultsProps) {
  const { t } = useTranslation()
  const {
    suites,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isLoadingError,
    isFetchNextPageError,
    isPlaceholderData,
    pageCount,
    refetch,
  } = useSuiteSummaries(projectId, filters)
  const resultsKey = JSON.stringify(toSuiteSummariesQuery(filters))
  const { listProps, markActivation } = useLoadMoreFocus({
    rowCount: suites.length,
    pageCount,
    resultsKey: `${projectId}:${resultsKey}`,
    hasFailed: isLoadingError || isFetchNextPageError,
  })
  const { message, eventId } = useResultsAnnouncement({
    resultsKey,
    rowCount: suites.length,
    pageCount,
    isSettled: !isLoading && !isLoadingError && !isPlaceholderData && !isFetchingNextPage,
    hasFailed: isLoadingError,
  })
  const announcement = useSpokenMessage(message, eventId)

  function renderContent() {
    if (isLoadingError) {
      return (
        <SuiteListError
          focusRegion={focusRegion}
          action={
            <Button
              type="button"
              variant="outline"
              className={ACTION_FOCUS_RING}
              onClick={(event) => {
                markActivation(event.currentTarget)
                void refetch()
              }}
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
      return (
        <div className="space-y-4">
          <SuiteRows projectId={projectId} suites={suites} listProps={listProps} />
          {hasNextPage && (
            <LoadMore
              isFetching={isFetchingNextPage}
              hasFailed={isFetchNextPageError}
              onLoad={(event) => {
                markActivation(event.currentTarget)
                void fetchNextPage()
              }}
              labels={{
                load: t('suites.loadMore'),
                loading: t('suites.loadingMore'),
                retry: t('common.retry'),
                error: t('suites.loadError'),
              }}
            />
          )}
        </div>
      )
    }

    if (hasSummariesFilter(filters)) {
      return (
        <div {...listProps}>
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
        </div>
      )
    }

    return (
      <div {...listProps}>
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
      </div>
    )
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="suite-list-announcement"
      >
        {announcement}
      </div>
      <div className="min-w-0" aria-busy={isPlaceholderData} data-testid="suite-list-results">
        {renderContent()}
      </div>
    </>
  )
}
