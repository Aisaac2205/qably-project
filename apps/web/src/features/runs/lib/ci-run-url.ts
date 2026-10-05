import type { CiRunSummaryRecord } from '@qably/types'
import { present } from './ci-run-format'

const REPOSITORY_SEGMENT_COUNT = 2
const DOT_SEGMENT = /^\.{1,2}$/
const GITHUB_RUN_ID = /^\d{1,20}$/

type CiRunUrlSource = Pick<CiRunSummaryRecord, 'source' | 'serverUrl' | 'repository' | 'externalId'>

function httpOrigin(serverUrl: string): string | undefined {
  try {
    const url = new URL(serverUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined
  } catch {
    return undefined
  }
}

function isPathSegment(segment: string): boolean {
  return segment !== '' && !DOT_SEGMENT.test(segment)
}

function runPagePath(repository: string, runId: string): string | undefined {
  const segments = repository.split('/')

  if (segments.length !== REPOSITORY_SEGMENT_COUNT) return undefined
  if (!segments.every(isPathSegment)) return undefined

  try {
    const [owner, name] = segments.map(encodeURIComponent)
    return `/${owner}/${name}/actions/runs/${runId}`
  } catch {
    return undefined
  }
}

export function buildCiRunUrl(ciRun: CiRunUrlSource): string | undefined {
  const serverUrl = present(ciRun.serverUrl)
  const repository = present(ciRun.repository)
  const externalId = present(ciRun.externalId)

  if (ciRun.source !== 'github_actions') return undefined
  if (serverUrl === undefined || repository === undefined || externalId === undefined) {
    return undefined
  }
  if (!GITHUB_RUN_ID.test(externalId)) return undefined

  const origin = httpOrigin(serverUrl)
  const path = runPagePath(repository, externalId)
  if (origin === undefined || path === undefined) return undefined

  return `${origin}${path}`
}
