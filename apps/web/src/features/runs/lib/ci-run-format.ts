import type { CiRunSummaryRecord } from '@qably/types'

const SHORT_SHA_LENGTH = 7
const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const SECONDS_PER_HOUR = MINUTES_PER_HOUR * SECONDS_PER_MINUTE
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR

type CiRunTitleSource = Pick<
  CiRunSummaryRecord,
  'externalId' | 'commitMessage' | 'workflowName' | 'commitSha'
>

type CiRunLabelSource = Pick<CiRunSummaryRecord, 'runNumber' | 'commitSha' | 'externalId'>

type CiRunMetaSource = Pick<
  CiRunSummaryRecord,
  'runNumber' | 'branch' | 'headRef' | 'commitSha' | 'commitAuthor' | 'actor'
>

export type CiRunLabel = { kind: 'number'; number: number } | { kind: 'text'; value: string }

export type CiRunMetaPart =
  | { kind: 'number'; number: number }
  | { kind: 'ref'; value: string }
  | { kind: 'sha'; value: string }
  | { kind: 'author'; value: string }

export type DurationUnitKey =
  | 'runs.ci.durationSeconds'
  | 'runs.ci.durationMinutes'
  | 'runs.ci.durationHours'

export interface DurationPart {
  key: DurationUnitKey
  count: number
}

export type FreshnessKey =
  | 'runs.ci.freshnessSeconds'
  | 'runs.ci.freshnessMinutes'
  | 'runs.ci.freshnessHours'
  | 'runs.ci.freshnessDays'

export interface FreshnessPart {
  key: FreshnessKey
  count: number
}

export function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === '' ? undefined : trimmed
}

function shortSha(sha: string | undefined): string | undefined {
  return present(sha)?.slice(0, SHORT_SHA_LENGTH)
}

function firstLine(message: string | undefined): string | undefined {
  return message
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '')
}

export function ciRunTitle(ciRun: CiRunTitleSource): string {
  return (
    firstLine(ciRun.commitMessage) ??
    present(ciRun.workflowName) ??
    shortSha(ciRun.commitSha) ??
    ciRun.externalId
  )
}

export function ciRunLabel(ciRun: CiRunLabelSource): CiRunLabel {
  if (ciRun.runNumber !== undefined) return { kind: 'number', number: ciRun.runNumber }

  return { kind: 'text', value: shortSha(ciRun.commitSha) ?? ciRun.externalId }
}

export function ciRunMetaParts(ciRun: CiRunMetaSource): CiRunMetaPart[] {
  const ref = present(ciRun.headRef) ?? present(ciRun.branch)
  const sha = shortSha(ciRun.commitSha)
  const author = present(ciRun.commitAuthor) ?? present(ciRun.actor)
  const parts: CiRunMetaPart[] = []

  if (ciRun.runNumber !== undefined) parts.push({ kind: 'number', number: ciRun.runNumber })
  if (ref !== undefined) parts.push({ kind: 'ref', value: ref })
  if (sha !== undefined) parts.push({ kind: 'sha', value: sha })
  if (author !== undefined) parts.push({ kind: 'author', value: author })

  return parts
}

export function approxDuration(
  startedAt: string,
  lastReportedAt: string,
): DurationPart[] | undefined {
  const totalSeconds = Math.floor((Date.parse(lastReportedAt) - Date.parse(startedAt)) / MS_PER_SECOND)

  if (!(totalSeconds >= 1)) return undefined

  if (totalSeconds < SECONDS_PER_MINUTE) {
    return [{ key: 'runs.ci.durationSeconds', count: totalSeconds }]
  }

  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR

  const parts: DurationPart[] = []

  if (hours > 0) parts.push({ key: 'runs.ci.durationHours', count: hours })
  if (minutes > 0) parts.push({ key: 'runs.ci.durationMinutes', count: minutes })

  return parts
}

export function freshness(lastReportedAt: string, now: number): FreshnessPart {
  const elapsed = now - Date.parse(lastReportedAt)
  const seconds = elapsed > 0 ? Math.floor(elapsed / MS_PER_SECOND) : 0

  if (seconds < SECONDS_PER_MINUTE) return { key: 'runs.ci.freshnessSeconds', count: seconds }
  if (seconds < SECONDS_PER_HOUR) {
    return { key: 'runs.ci.freshnessMinutes', count: Math.floor(seconds / SECONDS_PER_MINUTE) }
  }
  if (seconds < SECONDS_PER_DAY) {
    return { key: 'runs.ci.freshnessHours', count: Math.floor(seconds / SECONDS_PER_HOUR) }
  }
  return { key: 'runs.ci.freshnessDays', count: Math.floor(seconds / SECONDS_PER_DAY) }
}
