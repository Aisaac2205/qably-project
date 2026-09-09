'use client'

import Link from 'next/link'
import type { CaseDeltaEntry, RunDeltaDetail } from '@qably/types'
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

function DeltaGroup({
  heading,
  tone,
  entries,
  href,
}: {
  heading: string
  tone: 'fail' | 'pass'
  entries: CaseDeltaEntry[]
  href: string
}) {
  const { t } = useTranslation()
  const Icon = tone === 'fail' ? ArrowDown : ArrowUp
  const toneClass = tone === 'fail' ? 'text-fail' : 'text-pass'

  return (
    <div className="min-w-0">
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${toneClass}`}>
        <Icon size={13} weight="bold" aria-hidden="true" />
        {heading}
        <span className="font-mono tabular-nums">{entries.length}</span>
      </p>
      <ul className="mt-1 space-y-0.5" aria-label={heading}>
        {entries.map((entry) => (
          <li key={entry.testCaseId} className="text-sm text-default truncate">
            <Link
              href={href}
              className="hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
            >
              {entry.caseName}
            </Link>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-xs text-muted">{t('runs.whatChangedNone')}</li>
        )}
      </ul>
    </div>
  )
}

export function WhatChangedStrip({
  projectId,
  suiteId,
  delta,
}: {
  projectId: string
  suiteId: string
  delta: RunDeltaDetail | null
}) {
  const { t } = useTranslation()
  const suiteHref = `/projects/${projectId}/suites/${suiteId}`

  return (
    <section
      aria-labelledby="what-changed-heading"
      className="rounded-xl border border-border bg-surface shadow-xs px-4 py-3 space-y-2"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 id="what-changed-heading" className="text-sm font-semibold text-default">
          {t('runs.whatChanged')}
        </h2>
        <p className="text-xs text-muted">
          {delta === null ? t('runs.whatChangedFirstRun') : t('runs.whatChangedHint')}
        </p>
      </div>
      {delta !== null && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DeltaGroup
            heading={t('runs.whatChangedRegressions')}
            tone="fail"
            entries={delta.regressions}
            href={suiteHref}
          />
          <DeltaGroup
            heading={t('runs.whatChangedFixes')}
            tone="pass"
            entries={delta.fixes}
            href={suiteHref}
          />
        </div>
      )}
    </section>
  )
}
