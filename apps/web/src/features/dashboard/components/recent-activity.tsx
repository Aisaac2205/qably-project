'use client'

import { useId } from 'react'
import Link from 'next/link'
import { GitCommit, Play, CaretRight } from '@phosphor-icons/react'
import type { CiCommitActivityRecord, RunSummaryRecord } from '@qably/types'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
import { resolveCiCommitLink, resolveRunLink } from '@/features/dashboard/lib/resolve-activity-link'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

const QUEUE_LIMIT = 4

interface QueueSectionProps {
  title: string
  viewAllLabel: string
  href?: string
  children: React.ReactNode
}

function QueueSection({
  title,
  viewAllLabel,
  href = '/projects',
  children,
}: QueueSectionProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full min-w-0 flex-col p-5 @2xl:p-6 @2xl:border-r @2xl:border-border @2xl:last:border-r-0"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="text-sm font-semibold tracking-[-0.01em] text-default"
        >
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary transition-colors"
        >
          {viewAllLabel}
          <CaretRight size={11} weight="bold" aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-1 flex-col justify-between divide-y divide-border">{children}</div>
    </section>
  )
}

interface QueueRowProps {
  href?: string
  icon: React.ReactNode
  title: string
  subtitle: string
  trailing: React.ReactNode
}

function QueueRow({ href, icon, title, subtitle, trailing }: QueueRowProps) {
  const isInteractive = href !== undefined
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted transition-colors',
            isInteractive && 'group-hover:bg-primary/10 group-hover:text-primary',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'truncate text-xs font-medium text-default',
              isInteractive && 'group-hover:text-primary',
            )}
          >
            {title}
          </p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      {trailing}
    </>
  )

  if (!isInteractive) {
    return (
      <div className="flex min-h-14 items-center justify-between gap-3 py-3">{content}</div>
    )
  }

  return (
    <Link
      href={href}
      className="group flex min-h-14 items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
    >
      {content}
    </Link>
  )
}

function QueueSkeletonRows() {
  return (
    <>
      {Array.from({ length: QUEUE_LIMIT }).map((_, index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 py-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </>
  )
}

function runSubtitle(run: RunSummaryRecord, suiteName: string, locale: FormatLocale): string {
  const time = formatRelativeTime(run.startedAt, locale)
  if (run.name.includes(suiteName)) return time

  return `${suiteName} · ${time}`
}

export function RecentActivity() {
  const stats = useDashboardStats()
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const viewAllLabel = t('common.viewAll')
  const workQueueLabel = t('dashboard.workQueue')

  if (stats.summaryState.isError) {
    return (
      <Card
        as="section"
        className="@container flex h-full flex-col overflow-hidden"
        aria-label={workQueueLabel}
      >
        <StateView
          kind="error"
          title={t('dashboard.loadErrorTitle')}
          description={t('dashboard.loadErrorDescription')}
          action={
            <Button type="button" variant="outline" size="sm" onClick={stats.summaryState.retry}>
              {t('common.retry')}
            </Button>
          }
        />
      </Card>
    )
  }

  const isLoading = stats.summaryState.isLoading
  const runs = stats.recentRuns.slice(0, QUEUE_LIMIT)
  const ciCommits = stats.recentCiCommits.slice(0, QUEUE_LIMIT)

  function commitSubtitle(commit: CiCommitActivityRecord): string {
    const passed = t('dashboard.ciRunsPassed', {
      passed: commit.passedRunCount,
      total: commit.runCount,
    })

    return `${commit.shortSha} · ${passed} · ${formatRelativeTime(commit.lastRunAt, timeLocale)}`
  }

  return (
    <Card
      as="section"
      className="@container flex h-full flex-col overflow-hidden"
      aria-label={workQueueLabel}
    >
      <div className="grid flex-1 grid-cols-1 divide-y divide-border @2xl:grid-cols-2 @2xl:divide-x @2xl:divide-y-0">
        <QueueSection title={t('dashboard.recentRuns')} viewAllLabel={viewAllLabel}>
          {isLoading ? (
            <QueueSkeletonRows />
          ) : runs.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t('dashboard.noRuns')}</p>
          ) : (
            runs.map((run) => (
              <QueueRow
                key={run.id}
                href={resolveRunLink(run)}
                icon={<Play size={15} weight="fill" className="shrink-0" aria-hidden="true" />}
                title={run.name}
                subtitle={runSubtitle(run, run.suiteName, timeLocale)}
                trailing={<StatusChip status={run.status} />}
              />
            ))
          )}
        </QueueSection>

        <QueueSection title={t('dashboard.ciCommits')} viewAllLabel={viewAllLabel}>
          {isLoading ? (
            <QueueSkeletonRows />
          ) : ciCommits.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t('dashboard.noCiCommits')}</p>
          ) : (
            ciCommits.map((commit) => (
              <QueueRow
                key={commit.commitSha}
                href={resolveCiCommitLink(commit)}
                icon={
                  <GitCommit size={15} weight="bold" className="shrink-0" aria-hidden="true" />
                }
                title={commit.commitMessage ?? commit.shortSha}
                subtitle={commitSubtitle(commit)}
                trailing={<StatusChip status={commit.status} />}
              />
            ))
          )}
        </QueueSection>
      </div>
    </Card>
  )
}
