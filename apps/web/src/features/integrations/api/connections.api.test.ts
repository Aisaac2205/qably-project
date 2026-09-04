import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createConnection, rotateConnectionWebhookSecret } from './connections.api'

const fetchMock = vi.fn()

describe('createConnection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('carries the one-time webhook secret from the create response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          id: 'conn-1',
          organizationId: 'org-1',
          provider: 'GITHUB',
          name: 'acme/payments',
          repo: 'acme/payments',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          webhookSecret: 'f'.repeat(64),
        }),
    })

    const connection = await createConnection({
      provider: 'GITHUB',
      name: 'acme/payments',
      repo: 'acme/payments',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/connections'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(connection.webhookSecret).toBe('f'.repeat(64))
  })
})

describe('rotateConnectionWebhookSecret', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ webhookSecret: 'a'.repeat(64) }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('posts to the connection webhook-secret route', async () => {
    const rotated = await rotateConnectionWebhookSecret('conn-1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/connections/conn-1/webhook-secret'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(rotated).toEqual({ webhookSecret: 'a'.repeat(64) })
  })
})
