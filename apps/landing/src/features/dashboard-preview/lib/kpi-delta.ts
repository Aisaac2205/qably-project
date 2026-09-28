import type { KpiDeltaTone } from '@qably/ui/dashboard'
import type { DashboardOverviewKpis } from '@qably/types'

export type KpiPolarity = 'higher-is-better' | 'lower-is-better'

export const DASHBOARD_KPI_POLARITY: Record<keyof DashboardOverviewKpis, KpiPolarity> = {
  passRate: 'higher-is-better',
  runs: 'higher-is-better',
  failedCases: 'lower-is-better',
  avgRunDurationMs: 'lower-is-better',
}

export function resolveKpiDeltaTone(
  value: number | null,
  previous: number | null,
  polarity: KpiPolarity,
): KpiDeltaTone {
  if (value === null || previous === null) return 'neutral'

  const diff = value - previous
  if (diff === 0) return 'neutral'

  const increased = diff > 0
  const better = polarity === 'higher-is-better' ? increased : !increased

  return better ? 'better' : 'worse'
}
