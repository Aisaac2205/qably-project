'use client'

import type { RunCase } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { StatusChip } from './status-chip'
import { useTranslation } from '@/lib/i18n'

export function CaseDetail({ c }: { c: RunCase }) {
  const { t } = useTranslation()
  
  return (
    <Card className="h-full rounded-none border-0">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-medium text-default">{c.name}</h3>
          <StatusChip status={c.status} />
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('runs.steps')}
          </h4>
          <ol className="space-y-1 list-decimal list-inside">
            {c.steps.map((step, i) => (
              <li key={i} className="text-xs text-default leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('runs.expectedResult')}
          </h4>
          <p className="text-xs text-default bg-surface border border-border rounded p-2 leading-relaxed">
            {c.expectedResult}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
