'use client'

import { useTranslation } from '@/lib/i18n'

const AI_CASES = [
  { nameKey: 'dashboard.aiReady', value: 24, color: 'var(--color-pass)' },
  { nameKey: 'dashboard.aiGenerated', value: 18, color: 'var(--color-ai)' },
  { nameKey: 'dashboard.aiInReview', value: 8, color: 'var(--color-running)' },
  { nameKey: 'dashboard.aiRejected', value: 6, color: 'var(--color-fail)' },
]

export function AiCasesOverview() {
  const { t } = useTranslation()
  const total = AI_CASES.reduce((sum, item) => sum + item.value, 0)

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="ai-cases-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="ai-cases-heading" className="text-sm font-semibold text-default">
            {t('dashboard.aiCasesOverview')}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t('dashboard.pendingAiCases')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums text-default">{total}</p>
          <p className="text-xs text-muted">{t('common.total')}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {AI_CASES.map((item) => {
          const percentage = (item.value / total) * 100

          return (
            <div key={item.nameKey}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted">{t(item.nameKey)}</span>
                <span className="font-medium tabular-nums text-default">{item.value}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-canvas"
                role="progressbar"
                aria-label={t(item.nameKey)}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={item.value}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percentage}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
