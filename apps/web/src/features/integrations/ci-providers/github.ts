/**
 * GitHub CI provider adapter.
 *
 * Normalizes a GitHub `check_run` webhook payload into `NormalizedCIEvent`.
 * Other GitHub event types (`push`, `pull_request`, etc.) return `null` —
 * we only react to `check_run` completions.
 *
 * For the demo the verification is env-gated (see `app/api/webhooks/ci/.../route.ts`).
 * The `verifyHmac` function is exported so the route handler can call it
 * in production.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NormalizedCIEvent } from './types'

interface GitHubCheckRunPayload {
  action: string
  check_run: {
    id: number
    head_sha: string
    name: string
    status: string
    conclusion: string | null
    details_url: string | null
    external_id?: string | null
  }
  check_suite?: {
    id: number
    head_sha: string
    head_branch: string
    repository: { full_name: string }
  }
  repository?: { full_name: string }
}

/**
 * Verify the `X-Hub-Signature-256` header from GitHub.
 * Returns true if the HMAC matches; false otherwise.
 * Throws if the secret is missing in production.
 */
export function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Extract a `runId` from the payload. Qably launches CI workflows with
 * a `runId` query param that ends up in the workflow env. GitHub exposes
 * the original workflow run via the `external_id` field of the check_run
 * (when set) — we prefer that, falling back to `check_suite.id`.
 */
function extractRunId(payload: GitHubCheckRunPayload, runIdHeader: string | null): string {
  if (runIdHeader) return runIdHeader
  if (payload.check_run.external_id) return `github-${payload.check_run.external_id}`
  if (payload.check_suite) return `gh-suite-${payload.check_suite.id}`
  return `gh-${payload.check_run.id}`
}

/**
 * Normalize a GitHub webhook payload to a `NormalizedCIEvent`.
 * Returns `null` for non-`check_run` events.
 */
export function normalize(payload: unknown, runIdHeader: string | null = null): NormalizedCIEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Partial<GitHubCheckRunPayload>
  if (p.action === undefined || !p.check_run) return null
  if (p.check_run.status !== 'completed') return null

  const conclusion = p.check_run.conclusion
  const status: 'completed' | 'failed' = conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out'
    ? 'failed'
    : 'completed'

  const repository =
    p.check_suite?.repository?.full_name ??
    p.repository?.full_name ??
    'unknown/unknown'

  return {
    eventId: `check-run-${p.check_run.id}`,
    runId: extractRunId(p as GitHubCheckRunPayload, runIdHeader),
    provider: 'github',
    status,
    commitSha: p.check_run.head_sha,
    repository,
    url: p.check_run.details_url ?? '',
    receivedAt: new Date().toISOString(),
  }
}
