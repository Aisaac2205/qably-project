import type { CiRunJobRunRecord } from '@qably/types'
import { present } from './ci-run-format'

const REPORT_ID_SUFFIX = /-[0-9a-f]{8}(?:-p\d+)?$/
const jobKeyCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

interface ReportLabelContext {
  ciRunExternalId: string
  ciJobKey?: string
}

export interface CiRunJobGroup {
  key: string
  runs: CiRunJobRunRecord[]
}

export interface CiRunJobGroups {
  unnamed: CiRunJobRunRecord[]
  groups: CiRunJobGroup[]
}

export function humanizeJobKey(ciJobKey: string): string {
  return ciJobKey.replace(/[-_]/g, ' ')
}

export function groupRunsByJob(runs: readonly CiRunJobRunRecord[]): CiRunJobGroups {
  const unnamed: CiRunJobRunRecord[] = []
  const runsByKey = new Map<string, CiRunJobRunRecord[]>()

  for (const item of runs) {
    const key = present(item.ciJobKey)

    if (key === undefined) {
      unnamed.push(item)
    } else {
      runsByKey.set(key, [...(runsByKey.get(key) ?? []), item])
    }
  }

  const failingKeys = new Set(
    [...runsByKey].filter(([, keyRuns]) => keyRuns.some((item) => item.status === 'fail')).map(([key]) => key),
  )
  const groups = [...runsByKey].map(([key, keyRuns]) => ({ key, runs: keyRuns }))

  groups.sort(
    (a, b) =>
      Number(failingKeys.has(b.key)) - Number(failingKeys.has(a.key)) ||
      jobKeyCollator.compare(a.key, b.key),
  )

  return { unnamed, groups }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug === '' ? 'report' : slug
}

export function reportLabel(reportExternalId: string, context: ReportLabelContext): string {
  const runPrefix = `gha-${context.ciRunExternalId}-`
  if (!reportExternalId.startsWith(runPrefix)) return reportExternalId

  const withoutRun = reportExternalId.slice(runPrefix.length)
  const suffix = REPORT_ID_SUFFIX.exec(withoutRun)
  if (suffix === null) return reportExternalId

  const body = withoutRun.slice(0, suffix.index)
  const jobKey = present(context.ciJobKey)
  const jobPrefix =
    jobKey === undefined
      ? undefined
      : [jobKey, slugify(jobKey)].map((key) => `${key}-`).find((prefix) => body.startsWith(prefix))
  const label = jobPrefix === undefined ? body : body.slice(jobPrefix.length)

  return label === '' ? reportExternalId : label
}

export function reportLabelsByRun(
  runs: readonly CiRunJobRunRecord[],
  ciRunExternalId: string,
): Map<string, string> {
  const labels = new Map<string, string>()

  for (const item of runs) {
    const reportExternalId = present(item.reportExternalId)

    if (reportExternalId !== undefined) {
      labels.set(item.id, reportLabel(reportExternalId, { ciRunExternalId, ciJobKey: item.ciJobKey }))
    }
  }

  return new Set(labels.values()).size > 1 ? labels : new Map()
}
