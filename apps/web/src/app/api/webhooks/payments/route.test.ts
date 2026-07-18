/**
 * Payments webhook route — 501 stub (Commit 4 will implement).
 */
import { describe, it, expect } from 'vitest'
import { POST, GET } from './route'

describe('POST /api/webhooks/payments', () => {
  it('501 Not Implemented', async () => {
    const res = await POST()
    expect(res.status).toBe(501)
  })
})

describe('GET /api/webhooks/payments', () => {
  it('405 Method Not Allowed', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
  })
})
