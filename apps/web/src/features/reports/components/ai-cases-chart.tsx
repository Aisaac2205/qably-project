'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { AiCase } from '@qably/types'

interface AiCasesChartProps {
  aiCases: AiCase[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--status-warn)',
  confirmed: 'var(--status-pass)',
  rejected: 'var(--status-fail)',
}

export function AiCasesChart({ aiCases }: AiCasesChartProps) {
  if (aiCases.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        No data yet
      </div>
    )
  }

  const pending = aiCases.filter((c) => c.reviewStatus === 'pending').length
  const confirmed = aiCases.filter((c) => c.reviewStatus === 'confirmed').length
  const rejected = aiCases.filter((c) => c.reviewStatus === 'rejected').length

  const data = [
    { name: 'Pending', count: pending, fill: STATUS_COLORS.pending },
    { name: 'Confirmed', count: confirmed, fill: STATUS_COLORS.confirmed },
    { name: 'Rejected', count: rejected, fill: STATUS_COLORS.rejected },
  ]

  return (
    <div className="h-64" aria-label="Bar chart showing AI case review status">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-geist-sans)',
            }}
            formatter={(_value: unknown, _name: unknown) => [String(_value), 'Cases']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
