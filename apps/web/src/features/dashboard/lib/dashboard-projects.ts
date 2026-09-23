import type { DashboardProjectRow } from '@qably/types'

export function sortDashboardProjects(
  projects: readonly DashboardProjectRow[],
): DashboardProjectRow[] {
  return [...projects].sort((a, b) => {
    if (a.passRate === null && b.passRate === null) return 0
    if (a.passRate === null) return 1
    if (b.passRate === null) return -1
    return a.passRate - b.passRate
  })
}
