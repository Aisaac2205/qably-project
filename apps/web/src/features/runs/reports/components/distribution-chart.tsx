'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { RunSummaryRecord } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { useHydrated } from '@/hooks/use-hydrated'

interface DistributionChartProps {
  runs: RunSummaryRecord[]
}

export function DistributionChart({ runs }: DistributionChartProps) {
  const { t } = useTranslation()
  const hydrated = useHydrated()
  
  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        {t('common.noData')}
      </div>
    )
  }

  let totalPass = 0
  let totalFail = 0
  let totalOther = 0

  for (const run of runs) {
    totalPass += run.caseCounts.pass
    totalFail += run.caseCounts.fail
    totalOther += run.caseCounts.total - run.caseCounts.pass - run.caseCounts.fail
  }

  const total = totalPass + totalFail + totalOther
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        {t('common.noData')}
      </div>
    )
  }

  const data = [
    { name: t('common.pass'), value: totalPass, color: 'var(--status-pass)' },
    { name: t('common.fail'), value: totalFail, color: 'var(--status-fail)' },
    { name: t('reports.other'), value: totalOther, color: 'var(--fg-muted)' },
  ].filter((d) => d.value > 0)

  return (
    <div className="h-64" aria-label={t('reports.ariaDistributionChart')}>
      {hydrated ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="var(--bg-surface)"
            strokeWidth={1}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-geist-sans)',
            }}
            formatter={(value: unknown, name: unknown) => [String(value), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      ) : (
        <div style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  )
}
