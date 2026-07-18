/**
 * CI webhook route handler — Next.js 16 contract.
 *
 * Tests import the handler directly and call it with a manually-constructed
 * `Request` (Vite's import-analysis maps the route to a function in jsdom).
 * No Next.js dev server is needed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { POST, GET } from './route'
import { __resetStore, getCiEventLog } from '@/lib/mock-store'

const githubCompletedPayload = {
  action: 'completed',
  check_run: {
    id: 999,
    head_sha: 'sha-abc',
    name: 'CI',
    status: 'completed',
    conclusion: 'success',
    details_url: 'https://github.com/acme/repo/runs/999',
    external_id: 'qably-run-1',
  },
  check_suite: {
    id: 1000,
    head_sha: 'sha-abc',
    head_branch: 'main',
    repository: { full_name: 'acme/repo' },
  },
  repository: { full_name: 'acme/repo' },
}

function makeRequest(provider: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/webhooks/ci/${provider}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })
}

const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) })

describe('POST /api/webhooks/ci/[provider] — github', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('200 + records event for a valid github check_run payload', async () => {
    const res = await POST(makeRequest('github', githubCompletedPayload), ctx('github'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.eventId).toBe('check-run-999')
    expect(getCiEventLog()).toHaveLength(1)
    expect(getCiEventLog()[0].runId).toBe('github-qably-run-1')
  })

  it('202 for a github non-CI event (e.g. push)', async () => {
    const res = await POST(makeRequest('github', { ref: 'refs/heads/main' }), ctx('github'))
    expect(res.status).toBe(202)
  })

  it('400 for invalid JSON', async () => {
    const res = await POST(makeRequest('github', '{not json'), ctx('github'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/webhooks/ci/[provider] — stubs', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('501 for bitbucket (stub)', async () => {
    const res = await POST(makeRequest('bitbucket', { push: { changes: [] } }), ctx('bitbucket'))
    expect(res.status).toBe(501)
  })

  it('501 for gitlab (stub)', async () => {
    const res = await POST(makeRequest('gitlab', { object_kind: 'push' }), ctx('gitlab'))
    expect(res.status).toBe(501)
  })
})

describe('POST /api/webhooks/ci/[provider] — unknown provider', () => {
  it('404 for unknown provider', async () => {
    const res = await POST(makeRequest('travis', {}), ctx('travis'))
    expect(res.status).toBe(404)
  })
})

describe('GET /api/webhooks/ci/[provider]', () => {
  it('405 Method Not Allowed', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST')
  })
})
