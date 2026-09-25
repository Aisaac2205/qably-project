'use client'

import { Warning } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

interface SuiteCollisionsPanelProps {
  openCollisions: number | undefined
}

export function SuiteCollisionsPanel({ openCollisions }: SuiteCollisionsPanelProps) {
  const { t } = useTranslation()

  if (openCollisions === undefined || openCollisions === 0) return null

  return (
    <div
      role="status"
      className="space-y-1 rounded-xl border border-warn/40 bg-warn-bg/60 p-4"
    >
      <div className="flex items-center gap-1.5">
        <Warning size={14} weight="bold" className="shrink-0 text-warn" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-warn">{t('suites.openCollisionsTitle')}</h3>
      </div>
      <p className="text-sm text-default leading-relaxed">
        {t('suites.openCollisions', { count: openCollisions })}
      </p>
      <p className="text-xs text-muted leading-relaxed">{t('suites.openCollisionsHint')}</p>
    </div>
  )
}
