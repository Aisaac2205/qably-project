/**
 * GitHub adapter — NormalizedCIEvent contract.
 */
import { describe, it, expect } from 'vitest'
import { normalize, verifyHmac } from '../github'
import { createHmac } from 'node:crypto'

const basePayload = {
  action: 'completed',
  check_run: {
    id: 12345,
    head_sha: 'abc123def',
    name: 'CI',
    status: 'completed',
    conclusion: 'success',
    details_url: 'https://github.com/acme/repo/runs/12345',
    external_id: 'run-uuid-999',
  },
  check_suite: {
    id: 67890,
    head_sha: 'abc123def',
    head_branch: 'main',
    repository: { full_name: 'acme/repo' },
  },
  repository: { full_name: 'acme/repo' },
}

describe('github.normalize — success path', () => {
  it('produces a NormalizedCIEvent with provider=github, status=completed', () => {
    const out = normalize(basePayload, 'qably-run-1')
    expect(out).not.toBeNull()
    expect(out?.provider).toBe('github')
    expect(out?.status).toBe('completed')
    expect(out?.commitSha).toBe('abc123def')
    expect(out?.repository).toBe('acme/repo')
    expect(out?.runId).toBe('qably-run-1') // header wins
    expect(out?.url).toBe('https://github.com/acme/repo/runs/12345')
    expect(out?.eventId).toBe('check-run-12345')
    expect(out?.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('falls back to external_id when no runIdHeader', () => {
    const out = normalize(basePayload, null)
    expect(out?.runId).toBe('github-run-uuid-999')
  })

  it('falls back to check_suite.id when no external_id', () => {
    const noExternal = { ...basePayload, check_run: { ...basePayload.check_run, external_id: null } }
    const out = normalize(noExternal, null)
    expect(out?.runId).toBe('gh-suite-67890')
  })
})

describe('github.normalize — failure mapping', () => {
  it('conclusion=failure → status=failed', () => {
    const p = { ...basePayload, check_run: { ...basePayload.check_run, conclusion: 'failure' } }
    expect(normalize(p)?.status).toBe('failed')
  })

  it('conclusion=cancelled → status=failed', () => {
    const p = { ...basePayload, check_run: { ...basePayload.check_run, conclusion: 'cancelled' } }
    expect(normalize(p)?.status).toBe('failed')
  })

  it('conclusion=timed_out → status=failed', () => {
    const p = { ...basePayload, check_run: { ...basePayload.check_run, conclusion: 'timed_out' } }
    expect(normalize(p)?.status).toBe('failed')
  })

  it('conclusion=success → status=completed', () => {
    const p = { ...basePayload, check_run: { ...basePayload.check_run, conclusion: 'success' } }
    expect(normalize(p)?.status).toBe('completed')
  })
})

describe('github.normalize — non-CI events', () => {
  it('returns null for non-completed check_run (e.g. in_progress)', () => {
    const p = { ...basePayload, check_run: { ...basePayload.check_run, status: 'in_progress', conclusion: null } }
    expect(normalize(p)).toBeNull()
  })

  it('returns null for null payload', () => {
    expect(normalize(null)).toBeNull()
  })

  it('returns null for non-object payload', () => {
    expect(normalize('not-an-object' as unknown)).toBeNull()
  })
})

describe('github.verifyHmac', () => {
  const secret = 'super-secret-shared-key'
  const body = JSON.stringify({ action: 'completed' })
  const validSignature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

  it('returns true for a valid signature', () => {
    expect(verifyHmac(body, validSignature, secret)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    expect(verifyHmac(body, 'sha256=' + 'a'.repeat(64), secret)).toBe(false)
  })

  it('returns false for a null signature', () => {
    expect(verifyHmac(body, null, secret)).toBe(false)
  })

  it('returns false for a mismatched-length signature', () => {
    expect(verifyHmac(body, 'short', secret)).toBe(false)
  })
})
