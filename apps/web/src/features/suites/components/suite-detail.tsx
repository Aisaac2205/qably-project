'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, Star, ArrowLeft } from '@phosphor-icons/react'
import { useSuite, useProject, useRuns } from '@/lib/use-mock-store'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { Sparkline } from './sparkline'
import { CaseCard } from './case-card'
import { useSuiteMetrics } from '@/features/suites/hooks/use-suite-metrics'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatRelative(iso: string | undefined): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((then - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}

export function SuiteDetail({ projectId, suiteId }: { projectId: string; suiteId: string }) {
  const router = useRouter()
  const suite = useSuite(suiteId)
  const project = useProject(projectId)
  const runs = useRuns(projectId)
  const { perSuite } = useSuiteMetrics(projectId)
  const metrics = perSuite.find((m) => m.suite.id === suiteId)

  if (!suite) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: 'Not found' },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-muted">Suite not found</p>
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-primary font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden="true" />
            Back to project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Projects', href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
          { label: 'Suites', href: `/projects/${projectId}` },
          { label: suite.name },
        ]}
      />

      {/* Hero */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-semibold tracking-tight text-default text-wrap-balance">
                {suite.name}
              </h1>
              {suite.isDefault && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold text-warn bg-warn-bg border border-warn/20 rounded px-2 py-0.5"
                  title="Default suite for this project"
                >
                  <Star size={12} weight="fill" aria-hidden="true" />
                  Default
                </span>
              )}
            </div>
            {suite.description && (
              <p className="text-sm text-muted max-w-[65ch] text-wrap-pretty">
                {suite.description}
              </p>
            )}
            {suite.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {suite.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => router.push(`/projects/${projectId}/runs/new?suite=${suite.id}`)}
              className="text-sm font-semibold"
              size="default"
            >
              <Play size={14} weight="bold" aria-hidden="true" />
              Run this suite
            </Button>
          </div>
        </div>

        {/* Health strip — explains what this suite is doing right now */}
        {metrics && (
          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted border-t border-border pt-3"
            role="group"
            aria-label="Suite health"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">Status</span>
              <StatusChip status={metrics.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">Pass rate (7d)</span>
              <span
                className={`text-base font-mono font-semibold tabular-nums ${
                  metrics.passRate7d >= 70
                    ? 'text-pass'
                    : metrics.passRate7d > 0
                      ? 'text-warn'
                      : 'text-muted'
                }`}
              >
                {metrics.passRate7d}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">Last run</span>
              <span className="text-sm text-default">{formatRelative(metrics.lastRun?.startedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">Cases</span>
              <span className="text-sm font-mono font-semibold text-default tabular-nums">
                {suite.cases.length}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <Sparkline
                data={metrics.sparkline.map(({ date, passRate }) => ({ date, passRate }))}
                tone={metrics.passRate7d >= 70 ? 'pass' : metrics.passRate7d > 0 ? 'warn' : 'muted'}
                width={80}
                height={24}
              />
            </div>
          </div>
        )}
      </header>

      {/* Case list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-default">Test cases</h2>
          <span className="text-xs text-muted">
            {suite.cases.length} {suite.cases.length === 1 ? 'case' : 'cases'}
          </span>
        </div>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {suite.cases.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted">
                No test cases in this suite yet.
              </div>
            ) : (
              suite.cases.map((tc) => <CaseCard key={tc.id} testCase={tc} />)
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
