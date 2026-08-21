'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ExtractedProposal } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { useHydrated } from '@/hooks/use-hydrated'

interface ProposalReviewChartProps {
  proposals: ExtractedProposal[]
}

const STATUS_COLORS: Record<string, string> = {
  in_review: 'var(--status-warn)',
  approved: 'var(--status-pass)',
  rejected: 'var(--status-fail)',
}

export function ProposalReviewChart({ proposals }: ProposalReviewChartProps) {
  const { t } = useTranslation()
  const hydrated = useHydrated()
  
  if (proposals.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        {t('common.noData')}
      </div>
    )
  }

  const inReview = proposals.filter((p) => p.status === 'in_review').length
  const approved = proposals.filter((p) => p.status === 'approved').length
  const rejected = proposals.filter((p) => p.status === 'rejected').length

  const data = [
    { name: t('aiReview.statusPending'), count: inReview, fill: STATUS_COLORS.in_review },
    { name: t('aiReview.statusConfirmed'), count: approved, fill: STATUS_COLORS.approved },
    { name: t('aiReview.statusRejected'), count: rejected, fill: STATUS_COLORS.rejected },
  ]

  return (
    <div className="h-64" aria-label={t('reports.ariaProposalReviewChart')}>
      {hydrated ? (
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
