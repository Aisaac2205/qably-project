import type { CiRunSummaryRecord } from '@qably/types'
import { present } from './ci-run-format'

type CiRunUrlSource = Pick<CiRunSummaryRecord, 'source' | 'serverUrl' | 'repository' | 'externalId'>

function httpOrigin(serverUrl: string): string | undefined {
  try {
    const url = new URL(serverUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined
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

  const origin = httpOrigin(serverUrl)
  if (origin === undefined) return undefined

  const path = repository.split('/').map(encodeURIComponent).join('/')

  return `${origin}/${path}/actions/runs/${encodeURIComponent(externalId)}`
}
