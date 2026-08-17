'use client'

import type { RunCase } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { StatusChip } from './status-chip'
import { useTranslation } from '@/lib/i18n'

export function CaseDetail({ c }: { c: RunCase }) {
  const { t } = useTranslation()
  
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-default">{c.name}</h3>
        <StatusChip status={c.status} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted">
          {t('runs.steps')}
        </h4>
        <ol className="space-y-1.5 list-decimal list-inside text-xs sm:text-sm text-default leading-relaxed bg-canvas/40 border border-border/60 rounded-lg p-3 sm:p-4">
          {c.steps.map((step, i) => (
            <li key={i} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted">
          {t('runs.expectedResult')}
        </h4>
        <p className="text-xs sm:text-sm text-default bg-canvas/40 border border-border/60 rounded-lg p-3 sm:p-4 leading-relaxed">
          {c.expectedResult}
        </p>
      </div>
    </div>
  )
}
