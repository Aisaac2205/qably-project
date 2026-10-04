import type { CiRunSummaryRecord } from '@qably/types'

const SHORT_SHA_LENGTH = 7

type CiRunTitleSource = Pick<
  CiRunSummaryRecord,
  'externalId' | 'commitMessage' | 'workflowName' | 'commitSha'
>

type CiRunMetaSource = Pick<
  CiRunSummaryRecord,
  'runNumber' | 'branch' | 'headRef' | 'commitSha' | 'commitAuthor'
>

export type CiRunMetaPart =
  | { kind: 'number'; number: number }
  | { kind: 'ref'; value: string }
  | { kind: 'sha'; value: string }
  | { kind: 'author'; value: string }

function present(value: string | undefined): string | undefined {
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

export function ciRunMetaParts(ciRun: CiRunMetaSource): CiRunMetaPart[] {
  const ref = present(ciRun.headRef) ?? present(ciRun.branch)
  const sha = shortSha(ciRun.commitSha)
  const author = present(ciRun.commitAuthor)
  const parts: CiRunMetaPart[] = []

  if (ciRun.runNumber !== undefined) parts.push({ kind: 'number', number: ciRun.runNumber })
  if (ref !== undefined) parts.push({ kind: 'ref', value: ref })
  if (sha !== undefined) parts.push({ kind: 'sha', value: sha })
  if (author !== undefined) parts.push({ kind: 'author', value: author })

  return parts
}
