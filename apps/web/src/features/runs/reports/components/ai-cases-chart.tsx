'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { AiCase } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

interface AiCasesChartProps {
  aiCases: AiCase[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--status-warn)',
  confirmed: 'var(--status-pass)',
  rejected: 'var(--status-fail)',
}

export function AiCasesChart({ aiCases }: AiCasesChartProps) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  
  if (aiCases.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        {t('common.noData')}
      </div>
    )
  }

  const pending = aiCases.filter((c) => c.reviewStatus === 'pending').length
  const confirmed = aiCases.filter((c) => c.reviewStatus === 'confirmed').length
  const rejected = aiCases.filter((c) => c.reviewStatus === 'rejected').length

  const data = [
    { name: t('aiReview.statusPending'), count: pending, fill: STATUS_COLORS.pending },
    { name: t('aiReview.statusConfirmed'), count: confirmed, fill: STATUS_COLORS.confirmed },
    { name: t('aiReview.statusRejected'), count: rejected, fill: STATUS_COLORS.rejected },
  ]

  return (
    <div className="h-64" aria-label={t('reports.ariaAiCasesChart')}>
      {mounted ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            formatter={(_value: unknown, _name: unknown) => [String(_value), t('common.cases')]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      ) : (
        <div style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  )
}
