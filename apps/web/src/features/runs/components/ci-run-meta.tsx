'use client'

import { Fragment } from 'react'
import type { CiRunSummaryRecord } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ciRunMetaParts, type CiRunMetaPart } from '../lib/ci-run-format'

type CiRunMetaSource = Pick<
  CiRunSummaryRecord,
  'runNumber' | 'branch' | 'headRef' | 'commitSha' | 'commitAuthor' | 'actor'
>

function MetaPart({ part }: { part: CiRunMetaPart }) {
  const { t } = useTranslation()

  if (part.kind === 'number') {
    return <span>{t('runs.ci.ciNumber', { number: part.number })}</span>
  }

  if (part.kind === 'sha') {
    return <span className="font-mono text-default">{part.value}</span>
  }

  return <span className="wrap-anywhere">{part.value}</span>
}

export function CiRunMeta({ ciRun, className }: { ciRun: CiRunMetaSource; className?: string }) {
  const parts = ciRunMetaParts(ciRun)

  if (parts.length === 0) return null

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted', className)}>
      {parts.map((part, index) => (
        <Fragment key={part.kind}>
          {index > 0 && <span aria-hidden="true">·</span>}
          <MetaPart part={part} />
        </Fragment>
      ))}
    </div>
  )
}
