'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Run } from '@qably/types'

interface PassRateChartProps {
  runs: Run[]
}

export function PassRateChart({ runs }: PassRateChartProps) {
  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        No data yet
      </div>
    )
  }

  const sorted = [...runs]
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .slice(-10)

  const data = sorted.map((r) => ({
    name: new Date(r.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    passRate: r.passRate,
  }))

  return (
    <div className="h-64" aria-label="Line chart showing pass rate over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            stroke="var(--fg-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            stroke="var(--fg-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-geist-sans)',
            }}
            formatter={(value: unknown) => [`${value}%`, 'Pass Rate']}
          />
          <Line
            type="monotone"
            dataKey="passRate"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--primary)', stroke: 'var(--bg-surface)', strokeWidth: 1 }}
            activeDot={{ r: 5, fill: 'var(--primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
