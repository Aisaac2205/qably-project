'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { useQualityRisks } from '@/lib/use-mock-store'
import { StateView } from '@/components/ui/state-view'

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export function QualityRiskPanel() {
  const { t } = useTranslation()
  const risks = useQualityRisks()

  return (
    <section
      aria-labelledby="quality-risks-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="quality-risks-heading"
            className="text-base font-semibold tracking-[-0.015em] text-default"
          >
            {t('dashboard.qualityRisks')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {t('dashboard.qualityRisksSubtitle')}
          </p>
        </div>
        {risks.length > 0 ? (
          <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-canvas px-2.5 py-1 text-xs font-medium text-muted">
            {t('dashboard.activeSignalsCount', { count: risks.length })}
          </span>
        ) : null}
      </div>

      {risks.length === 0 ? (
        <StateView
          kind="empty"
          title={t('dashboard.qualityRisksEmptyTitle')}
          description={t('dashboard.qualityRisksEmptyDesc')}
          className="mt-2"
        />
      ) : (
        <div className="mt-4 divide-y divide-border/60">
          {risks.map((risk) => (
            <div
              key={risk.id}
              className="group flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-3">
                <WarningCircle
                  size={16}
                  weight="regular"
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-muted transition-colors group-hover:text-default"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-default">
                    {SEVERITY_LABEL[risk.severity] ?? risk.severity}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {risk.criteria.join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
