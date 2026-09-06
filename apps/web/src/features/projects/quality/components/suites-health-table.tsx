'use client'

import Link from 'next/link'
import type { RunStatus, SuiteMetricsEntry } from '@qably/types'
import { DataTable } from '@/components/ui/data-table'
import { StateView } from '@/components/ui/state-view'
import { StatusChip } from '@/components/ui/status-chip'
import { useTranslation } from '@/lib/i18n'

interface SuitesHealthTableProps {
  projectId: string
  items: SuiteMetricsEntry[]
  suiteNames: ReadonlyMap<string, string>
}

function formatPassRate(passRate: number): string {
  return `${Math.round(passRate * 100)}%`
}

function trendSummary(trend: RunStatus[]): string {
  if (trend.length === 0) return '—'
  const passCount = trend.filter((status) => status === 'pass').length
  return `${passCount}/${trend.length}`
}

export function SuitesHealthTable({ projectId, items, suiteNames }: SuitesHealthTableProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('quality.suitesEmptyTitle')}
        description={t('quality.suitesEmptyDescription')}
      />
    )
  }

  return (
    <DataTable
      caption={t('quality.suitesTableCaption')}
      wrapperClassName="rounded-xl border border-border bg-surface shadow-card"
    >
      <thead>
        <tr className="border-b border-border text-left text-xs font-medium text-muted">
          <th scope="col" className="px-4 py-2.5">{t('quality.suitesColumnSuite')}</th>
          <th scope="col" className="px-4 py-2.5">{t('quality.suitesColumnLastRun')}</th>
          <th scope="col" className="px-4 py-2.5">{t('quality.suitesColumnPassRate')}</th>
          <th scope="col" className="px-4 py-2.5">{t('quality.suitesColumnTrend')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map((item) => (
          <tr key={item.suiteId}>
            <td className="px-4 py-3 text-sm font-medium text-default">
              <Link
                href={`/projects/${projectId}/suites/${item.suiteId}`}
                className="rounded transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                {suiteNames.get(item.suiteId) ?? item.suiteId}
              </Link>
            </td>
            <td className="px-4 py-3">
              {item.lastRun ? (
                <StatusChip status={item.lastRun.status} />
              ) : (
                <span className="text-xs text-muted">{t('common.noData')}</span>
              )}
            </td>
            <td className="px-4 py-3 font-mono text-sm tabular-nums text-default">
              {item.lastRun ? formatPassRate(item.lastRun.passRate) : '—'}
            </td>
            <td className="px-4 py-3 font-mono text-sm tabular-nums text-muted">
              {trendSummary(item.trend)}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
