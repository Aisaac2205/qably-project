'use client'

import Link from 'next/link'
import { Code, Play, CaretRight } from '@phosphor-icons/react'
import { StatusChip } from '@/components/ui/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime } from '@/features/dashboard/lib/format'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { useTranslation } from '@/lib/i18n'

interface QueueSectionProps {
  title: string
  href?: string
  children: React.ReactNode
}

function QueueSection({ title, href = '/projects', children }: QueueSectionProps) {
  return (
    <section className="flex h-full min-w-0 flex-col p-5 md:p-6 md:border-r md:border-border md:last:border-r-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-default">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary transition-colors"
        >
          View all
          <CaretRight size={11} weight="bold" aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-1 flex-col justify-between divide-y divide-border">{children}</div>
    </section>
  )
}

export function RecentActivity() {
  const stats = useDashboardStats()
  const { suites } = useSuites()
  const { t } = useTranslation()

  const suiteNameById = new Map(suites.map((suite) => [suite.id, suite.name]))
  const runs = stats.recentRuns.slice(0, 4)
  const ciRuns = stats.recentCiRuns.slice(0, 4)

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs" aria-label="Operational work queue">
      <div className="grid flex-1 grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <QueueSection title={t('dashboard.recentRuns')}>
          {runs.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t('dashboard.noRuns')}</p>
          ) : (
            runs.map((run) => (
              <Link
                key={run.id}
                href="/projects"
                className="group flex min-h-14 items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Play size={15} weight="fill" className="shrink-0" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-default group-hover:text-primary">{run.name}</p>
                    <p className="truncate text-xs text-muted">{suiteNameById.get(run.suiteId) ?? ''}</p>
                  </div>
                </div>
                <StatusChip status={run.status} />
              </Link>
            ))
          )}
        </QueueSection>

        <QueueSection title={t('dashboard.recentPipelines')}>
          {ciRuns.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t('dashboard.noPipelines')}</p>
          ) : (
            ciRuns.map((run) => (
              <Link
                key={run.id}
                href="/projects"
                className="group flex min-h-14 items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Code size={15} weight="bold" className="shrink-0" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-default group-hover:text-primary">
                      {run.commitMessage ?? run.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {run.commitSha && <span>{run.commitSha}</span>}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">{formatRelativeTime(run.startedAt)}</span>
              </Link>
            ))
          )}
        </QueueSection>
      </div>
    </section>
  )
}