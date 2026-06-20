'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Run } from '@qably/types'

interface DistributionChartProps {
  runs: Run[]
}

export function DistributionChart({ runs }: DistributionChartProps) {
  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        No data yet
      </div>
    )
  }

  let totalPass = 0
  let totalFail = 0
  let totalOther = 0

  for (const run of runs) {
    for (const c of run.cases) {
      if (c.status === 'pass') totalPass++
      else if (c.status === 'fail') totalFail++
      else totalOther++
    }
  }

  const total = totalPass + totalFail + totalOther
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        No data yet
      </div>
    )
  }

  const data = [
    { name: 'Pass', value: totalPass, color: 'var(--status-pass)' },
    { name: 'Fail', value: totalFail, color: 'var(--status-fail)' },
    { name: 'Other', value: totalOther, color: 'var(--fg-muted)' },
  ].filter((d) => d.value > 0)

  return (
    <div className="h-64" aria-label="Donut chart showing pass/fail distribution">
      <ResponsiveContainer width="100%" height="100%">
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
    </div>
  )
}
