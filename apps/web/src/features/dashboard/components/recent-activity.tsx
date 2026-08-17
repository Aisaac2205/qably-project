'use client'

import Link from 'next/link'
import { Code, Play, Sparkle } from '@phosphor-icons/react'
import { StatusChip } from '@/components/ui/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

function getCasePriority(name: string): { label: string; className: string } {
  if (name.toLowerCase().includes('login') || name.toLowerCase().includes('critical')) {
    return { label: 'High', className: 'text-fail' }
  }

  return { label: 'Medium', className: 'text-warn' }
}

interface QueueSectionProps {
  title: string
  children: React.ReactNode
}

function QueueSection({ title, children }: QueueSectionProps) {
  return (
    <section className="min-w-0 px-5 py-5 first:pt-0 xl:border-r xl:border-border xl:last:border-r-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-default">{title}</h2>
        <Link href="/projects" className="text-xs font-medium text-primary hover:text-primary-hover">
          View all
        </Link>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export function RecentActivity() {
  const stats = useDashboardStats()
  const { t } = useTranslation()

  const runs = stats.recentRuns.slice(0, 4)
  const aiCases = stats.recentAiCases.slice(0, 3)
  const ciRuns = stats.recentCiRuns.slice(0, 3)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label="Operational work queue">
      <div className="grid grid-cols-1 divide-y divide-border xl:grid-cols-3 xl:divide-x xl:divide-y-0">
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
                <div className="flex min-w-0 items-center gap-2.5">
                  <Play size={15} className="shrink-0 text-muted group-hover:text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-default group-hover:text-primary">{run.name}</p>
                    <p className="truncate text-xs text-muted">{run.suiteName}</p>
                  </div>
                </div>
                <StatusChip status={run.status} />
              </Link>
            ))
          )}
        </QueueSection>

        <QueueSection title={t('dashboard.pendingAiCases')}>
          {aiCases.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t('dashboard.noPendingAi')}</p>
          ) : (
            aiCases.map((testCase) => {
              const priority = getCasePriority(testCase.name)

              return (
                <Link
                  key={testCase.id}
                  href="/projects"
                  className="group flex min-h-14 items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Sparkle size={15} className="shrink-0 text-ai group-hover:text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-default group-hover:text-primary">{testCase.name}</p>
                      <p className="truncate text-xs font-mono text-muted">{testCase.sourceFile}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${priority.className}`}>{priority.label}</span>
                </Link>
              )
            })
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
                <div className="flex min-w-0 items-center gap-2.5">
                  <Code size={15} className="shrink-0 text-muted group-hover:text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-default group-hover:text-primary">
                      {run.commitMessage ?? run.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {run.commitSha && <span className="font-mono">{run.commitSha}</span>}
                      {run.commitSha && run.branch ? ' · ' : null}
                      {run.branch ? <span>{run.branch}</span> : null}
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