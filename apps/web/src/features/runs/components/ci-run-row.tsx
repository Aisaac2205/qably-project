'use client'

import Link from 'next/link'
import type { CiRunSummaryRecord } from '@qably/types'
import { ciRunTitle } from '../lib/ci-run-format'
import { CiRunMeta } from './ci-run-meta'
import { CiRunDuration, CiRunFreshness } from './ci-run-timing'
import { StatusChip } from './status-chip'

export function CiRunRow({
  ciRun,
  projectId,
  now,
}: {
  ciRun: CiRunSummaryRecord
  projectId: string
  now: number
}) {
  return (
    <Link
      href={`/projects/${projectId}/runs/ci/${ciRun.id}`}
      className="flex min-h-11 items-start gap-3.5 px-5 py-3 transition-colors hover:bg-surface-hover/60 focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-7 sm:py-3.5 lg:px-9"
    >
      <StatusChip status={ciRun.status} scope="ci-run" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="wrap-anywhere text-sm font-semibold text-default">{ciRunTitle(ciRun)}</p>
          <CiRunMeta ciRun={ciRun} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted sm:flex-col sm:items-end">
          <CiRunDuration startedAt={ciRun.startedAt} lastReportedAt={ciRun.lastReportedAt} />
          <CiRunFreshness lastReportedAt={ciRun.lastReportedAt} now={now} />
        </div>
      </div>
    </Link>
  )
}
