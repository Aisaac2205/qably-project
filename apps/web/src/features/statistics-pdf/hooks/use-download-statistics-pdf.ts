'use client'

import { useCallback, useRef, useState } from 'react'
import type { DashboardPeriod } from '@qably/types'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { useTranslation } from '@/lib/i18n'
import { notify } from '@/lib/notify'
import { buildStatisticsReport, statisticsPdfFileName } from '../lib/build-statistics-report'
import { saveBlob } from '../lib/save-blob'

export interface UseDownloadStatisticsPdfOptions {
  readonly period: DashboardPeriod
  /** Narrows the report to one project; omitted for the organization-wide dashboard. */
  readonly projectId?: string
  readonly projectName?: string
}

export interface DownloadStatisticsPdfState {
  readonly download: () => Promise<void>
  /** True once the overview for exactly this period is in the cache. */
  readonly isReady: boolean
  readonly isGenerating: boolean
}

/**
 * Exports the statistics the page is already showing as a PDF. It reads the
 * same cached `useDashboardOverview` query as the page, so the PDF mirrors the
 * selected period and scope, and loads the PDF renderer only on demand.
 */
export function useDownloadStatisticsPdf({
  period,
  projectId,
  projectName,
}: UseDownloadStatisticsPdfOptions): DownloadStatisticsPdfState {
  const { overview } = useDashboardOverview(period, projectId)
  const { t, locale } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const inFlight = useRef(false)

  // While a new period loads, the query keeps the previous period's data as a
  // placeholder; exporting it would label old numbers with the new period.
  const isReady = overview !== undefined && overview.period === period

  const download = useCallback(async () => {
    if (inFlight.current || overview === undefined || overview.period !== period) return

    inFlight.current = true
    setIsGenerating(true)
    try {
      const scope = projectId ? 'project' : 'organization'
      const generatedAt = new Date()
      const report = buildStatisticsReport(overview, { scope, projectName, period, generatedAt, locale, t })
      const { renderStatisticsPdf } = await import('../lib/render-statistics-pdf')
      const blob = await renderStatisticsPdf(report)
      saveBlob(
        blob,
        statisticsPdfFileName({ scope, projectName, period, generatedAt, timeZone: overview.timeZone }),
      )
    } catch {
      notify.error(t('statisticsPdf.errorTitle'), { description: t('statisticsPdf.errorDescription') })
    } finally {
      inFlight.current = false
      setIsGenerating(false)
    }
  }, [locale, overview, period, projectId, projectName, t])

  return { download, isReady, isGenerating }
}
