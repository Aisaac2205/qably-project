import type { DashboardPeriod } from '@qably/types'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (projectId: string) => ['dashboard', 'summary', projectId] as const,
  traceability: (year: number, projectId: string, tz?: string) =>
    ['dashboard', 'traceability', year, projectId, tz] as const,
  overview: (period: DashboardPeriod, projectId: string, tz?: string) =>
    ['dashboard', 'overview', period, projectId, tz] as const,
  channels: (tz?: string) => ['dashboard', 'channels', tz] as const,
}
