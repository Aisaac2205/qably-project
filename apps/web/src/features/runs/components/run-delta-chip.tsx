'use client'

import type { RunDeltaCounts } from '@qably/types'
import { ArrowDown, ArrowUp, Equals } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function RunDeltaChip({ delta }: { delta: RunDeltaCounts | null }) {
  const { t } = useTranslation()

  if (delta === null) return null

  return (
    <span
      role="group"
      aria-label={t('runs.deltaAria', {
        regressions: delta.regressions,
        fixes: delta.fixes,
        unchanged: delta.unchanged,
      })}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-canvas/60 px-2 py-0.5 text-xs font-mono tabular-nums"
    >
      <span className={delta.regressions > 0 ? 'inline-flex items-center gap-0.5 text-fail' : 'inline-flex items-center gap-0.5 text-muted'}>
        <ArrowDown size={11} weight="bold" aria-hidden="true" />
        {delta.regressions}
        <span className="sr-only">{t('runs.deltaRegressions', { count: delta.regressions })}</span>
      </span>
      <span className={delta.fixes > 0 ? 'inline-flex items-center gap-0.5 text-pass' : 'inline-flex items-center gap-0.5 text-muted'}>
        <ArrowUp size={11} weight="bold" aria-hidden="true" />
        {delta.fixes}
        <span className="sr-only">{t('runs.deltaFixes', { count: delta.fixes })}</span>
      </span>
      <span className="inline-flex items-center gap-0.5 text-muted">
        <Equals size={11} weight="bold" aria-hidden="true" />
        {delta.unchanged}
        <span className="sr-only">{t('runs.deltaUnchanged', { count: delta.unchanged })}</span>
      </span>
    </span>
  )
}
