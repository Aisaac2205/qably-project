'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { CaretRight, Warning } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import type { OpenCollisionSuite } from '../api/review.api'

const COLLAPSED_SUITE_COUNT = 3

interface InboxCollisionsNoticeProps {
  suites: readonly OpenCollisionSuite[]
}

export function InboxCollisionsNotice({ suites }: InboxCollisionsNoticeProps) {
  const { t } = useTranslation()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)

  if (suites.length === 0) return null

  const collapsible = suites.length > COLLAPSED_SUITE_COUNT
  const visible = collapsible && !expanded ? suites.slice(0, COLLAPSED_SUITE_COUNT) : suites

  return (
    <div className="flex items-start gap-1.5 rounded-xl border border-warn/40 bg-warn-bg/60 p-3">
      <Warning size={14} weight="bold" className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <p role="status" className="text-sm text-default leading-relaxed">
          {t('reviewInbox.openCollisions', { count: suites.length })}
        </p>

        <ul id={listId} className="space-y-0.5">
          {visible.map((suite) => (
            <li key={suite.suiteId}>
              <Link
                href={`/projects/${suite.projectId}/suites/${suite.suiteId}`}
                className="group flex min-h-6 items-center gap-2 rounded-md px-1.5 py-0.5 text-sm outline-none transition-colors hover:bg-warn-bg focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-default group-hover:underline">
                    {suite.suiteName}
                  </span>
                  <span className="text-muted"> · {suite.projectName}</span>
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
                  {t('reviewInbox.collisionSuiteKeys', { count: suite.count })}
                </span>
                <CaretRight size={12} className="shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((current) => !current)}
            className="min-h-6 rounded-md px-1.5 text-xs font-medium text-muted outline-none transition-colors hover:text-default focus-visible:ring-2 focus-visible:ring-primary"
          >
            {expanded
              ? t('reviewInbox.collisionSuitesShowFewer')
              : t('reviewInbox.collisionSuitesShowAll', { count: suites.length })}
          </button>
        ) : null}
      </div>
    </div>
  )
}
