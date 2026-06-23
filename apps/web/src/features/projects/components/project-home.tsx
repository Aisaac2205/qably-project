'use client'

/**
 * ProjectHome — the project dashboard at `/projects/[id]/`.
 *
 * Composition (top to bottom):
 *   1. ProjectHeader (project name, health, last-run chip, description)
 *   2. ProjectKpiRow (4 project-level KPIs)
 *   3. Recent suites (top 3 by last run, with status)
 *   4. Recent runs (top 3)
 *   5. Pending AI cases (top 3)
 *
 * Each "Recent" section is a Card with a header (title + "View all" link)
 * and a list, or an empty state when there's no data.
 *
 * Stays inside `features/projects/`. No cross-feature imports.
 */
import Link from 'next/link'
import { TestTube, ListChecks, Sparkle } from '@phosphor-icons/react'
import { useRuns, useAiCases, useSuites } from '@/lib/use-mock-store'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { getLastRun, getSuiteRunStatus } from '@/lib/execution-metrics'
import { ProjectHeader } from './project-header'
import { ProjectKpiRow } from './project-kpi-row'
import type { Project, SuiteRunStatus } from '@qably/types'

interface SectionProps {
  title: string
  viewAllHref?: string
  icon?: React.ElementType
  count?: number
  children: React.ReactNode
}

function Section({ title, viewAllHref, icon: Icon, count, children }: SectionProps) {
  return (
    <section>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} weight="duotone" className="text-muted" aria-hidden="true" />}
            <CardTitle className="text-sm font-semibold text-default">
              {title}
            </CardTitle>
            {typeof count === 'number' && count > 0 && (
              <span className="text-[10px] text-muted font-mono">({count})</span>
            )}
          </div>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-[11px] text-primary font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              View all →
            </Link>
          )}
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </Card>
    </section>
  )
}

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

function RecentSuites({ projectId }: { projectId: string }) {
  const suites = useSuites(projectId)
  const runs = useRuns(projectId)
  const withRuns = suites
    .map((suite) => ({
      suite,
      lastRun: getLastRun(runs, suite.id),
      status: getSuiteRunStatus(runs, suite.id) as SuiteRunStatus,
    }))
    .filter((m) => m.lastRun !== undefined)
    .sort((a, b) => (b.lastRun?.startedAt ?? '').localeCompare(a.lastRun?.startedAt ?? ''))
    .slice(0, 3)

  if (withRuns.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">
        No suites with runs yet.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border" role="list">
      {withRuns.map((m) => (
        <li
          key={m.suite.id}
          className="flex items-center justify-between py-2 px-1 gap-3"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/projects/${projectId}/suites/${m.suite.id}`}
              className="text-sm font-medium text-default hover:underline truncate block"
            >
              {m.suite.name}
            </Link>
            <span className="text-[10px] text-muted font-mono">
              {m.suite.cases.length} {m.suite.cases.length === 1 ? 'case' : 'cases'}
            </span>
          </div>
          <StatusChip status={m.status} />
        </li>
      ))}
    </ul>
  )
}

function RecentRuns({ projectId }: { projectId: string }) {
  const runs = useRuns(projectId)
  const recent = runs.slice(0, 3)

  if (recent.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">No runs yet.</p>
    )
  }

  return (
    <ul className="divide-y divide-border" role="list">
      {recent.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between py-2 px-1 gap-3"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/projects/${projectId}/runs/${r.id}`}
              className="text-sm font-medium text-default hover:underline truncate block"
            >
              {r.name}
            </Link>
            <span className="text-[10px] text-muted">
              {r.suiteName} · {formatRelative(r.startedAt)}
              {r.source === 'github_actions' && r.commitSha && (
                <> · <span className="font-mono">{r.commitSha}</span></>
              )}
            </span>
          </div>
          <StatusChip status={r.status} />
        </li>
      ))}
    </ul>
  )
}

function RecentAiCases({ projectId }: { projectId: string }) {
  const cases = useAiCases(projectId)
  const pending = cases.filter((c) => c.reviewStatus === 'pending').slice(0, 3)

  if (pending.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">
        No pending AI cases.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border" role="list">
      {pending.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between py-2 px-1 gap-3"
        >
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-default truncate block">
              {c.name}
            </span>
            <span className="text-[10px] text-muted font-mono truncate block">
              {c.sourceFile}
            </span>
          </div>
          <StatusChip status="pending" />
        </li>
      ))}
    </ul>
  )
}

export function ProjectHome({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <ProjectHeader project={project} />
      <ProjectKpiRow projectId={project.id} />

      <Section
        title="Recent suites"
        viewAllHref={`/projects/${project.id}/suites`}
        icon={TestTube}
      >
        <RecentSuites projectId={project.id} />
      </Section>

      <Section
        title="Recent runs"
        viewAllHref={`/projects/${project.id}/runs`}
        icon={ListChecks}
      >
        <RecentRuns projectId={project.id} />
      </Section>

      <Section
        title="Pending AI cases"
        viewAllHref={`/projects/${project.id}/ai-review`}
        icon={Sparkle}
      >
        <RecentAiCases projectId={project.id} />
      </Section>
    </div>
  )
}
