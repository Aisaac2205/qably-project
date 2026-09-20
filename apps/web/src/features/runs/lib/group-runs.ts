import type { RunSummaryRecord } from '@qably/types'

export interface RunReportGroup {
  key: string
  runs: RunSummaryRecord[]
}

export function groupConsecutiveRuns(
  runs: readonly RunSummaryRecord[],
): RunReportGroup[] {
  const groups: RunReportGroup[] = []

  for (const run of runs) {
    const last = groups[groups.length - 1]
    if (run.reportExternalId !== '' && last?.key === run.reportExternalId) {
      last.runs.push(run)
      continue
    }
    groups.push({ key: run.reportExternalId || run.id, runs: [run] })
  }

  return groups
}
