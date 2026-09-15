'use client'

import Link from 'next/link'
import type { RunStatus, SuiteMetricsEntry } from '@qably/types'
import { DataTable } from '@/components/ui/data-table'
import { StateView } from '@/components/ui/state-view'
import { StatusChip } from '@/components/ui/status-chip'
import { getLegacyStatusPresentation, statusToneClassNames } from '@/components/ui/status-presentation'
import { useTranslation } from '@/lib/i18n'
import { TONE_SOLID_BG_CLASSES, toneForPassRatePercent } from '../lib/tone'

interface SuitesHealthTableProps {
  projectId: string
  items: SuiteMetricsEntry[]
}

const TICK_SOLID_BG_CLASSES: Record<string, string> = {
  pass: TONE_SOLID_BG_CLASSES.pass,
  fail: TONE_SOLID_BG_CLASSES.fail,
  warn: TONE_SOLID_BG_CLASSES.warn,
  blocked: 'bg-blocked',
  running: 'bg-running',
  muted: 'bg-skip',
}

function formatPassRate(passRate: number): string {
  return `${Math.round(passRate * 100)}%`
}

function trendSummary(trend: RunStatus[]): string {
  if (trend.length === 0) return '—'
  const passCount = trend.filter((status) => status === 'pass').length
  return `${passCount}/${trend.length}`
}

interface PassRateMeterProps {
  passRate: number
}

function PassRateMeter({ passRate }: PassRateMeterProps) {
  const percent = Math.max(0, Math.min(100, Math.round(passRate * 100)))
  const tone = toneForPassRatePercent(percent)
  return (
    <div className="flex items-center justify-end gap-2">
      <span aria-hidden="true" className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-border/60">
        <span
          data-quality-meter-fill
          className={`block h-full rounded-full ${TONE_SOLID_BG_CLASSES[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="font-mono tabular-nums">{formatPassRate(passRate)}</span>
    </div>
  )
}

interface TrendStripProps {
  trend: RunStatus[]
}

function TrendStrip({ trend }: TrendStripProps) {
  const { t } = useTranslation()

  if (trend.length === 0) {
    return <span className="text-xs text-muted">—</span>
  }

  const label = t('quality.suitesTrendHistoryLabel', {
    list: trend.map((status) => t(getLegacyStatusPresentation(status).labelKey)).join(', '),
  })

  return (
    <div className="flex items-center justify-end gap-2">
      <span
        data-quality-trend-strip
        role="img"
        aria-label={label}
        className="inline-flex items-center gap-0.5"
      >
        {trend.map((status, index) => {
          const tone = getLegacyStatusPresentation(status).tone
          return (
            <span
              key={index}
              data-quality-trend-tick
              aria-hidden="true"
              className={`h-4 w-1.5 rounded-full ${TICK_SOLID_BG_CLASSES[tone] ?? statusToneClassNames[tone]}`}
            />
          )
        })}
      </span>
      <span className="font-mono text-xs tabular-nums text-muted">{trendSummary(trend)}</span>
    </div>
  )
}

export function SuitesHealthTable({ projectId, items }: SuitesHealthTableProps) {
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
          <th scope="col" className="px-4 py-2.5 text-right">{t('quality.suitesColumnPassRate')}</th>
          <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">
            {t('quality.suitesColumnTrend')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map((item) => (
          <tr key={item.suiteId}>
            <td className="px-4 py-3 text-sm font-medium text-default">
              <Link
                href={`/projects/${projectId}/suites/${item.suiteId}`}
                className="rounded transition-colors duration-150 ease [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                {item.suiteName}
              </Link>
            </td>
            <td className="px-4 py-3">
              {item.lastRun ? (
                <StatusChip status={item.lastRun.status} />
              ) : (
                <span className="text-xs text-muted">{t('common.noData')}</span>
              )}
            </td>
            <td className="px-4 py-3 text-right text-sm tabular-nums text-default">
              {item.lastRun ? <PassRateMeter passRate={item.lastRun.passRate} /> : '—'}
            </td>
            <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted sm:table-cell">
              <TrendStrip trend={item.trend} />
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
