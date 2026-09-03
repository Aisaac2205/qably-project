import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNotificationWebhook,
  deleteNotificationWebhook,
  listNotificationWebhooks,
  testNotificationWebhook,
  updateNotificationWebhook,
} from './notification-webhooks.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

describe('notification-webhooks.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'webhook-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists the org notification webhooks', async () => {
    await listNotificationWebhooks()

    const [url, init] = lastCall()
    expect(url).toContain('/notification-webhooks')
    expect(init.method).toBe('GET')
  })

  it('creates a webhook with type, name, url and eventTypes', async () => {
    await createNotificationWebhook({
      type: 'slack',
      name: 'Team alerts',
      url: 'https://hooks.slack.com/services/T00/B00/token',
      eventTypes: ['run_failed'],
    })

    const [url, init] = lastCall()
    expect(url).toContain('/notification-webhooks')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'slack',
      name: 'Team alerts',
      url: 'https://hooks.slack.com/services/T00/B00/token',
      eventTypes: ['run_failed'],
    })
  })

  it('patches a webhook by id', async () => {
    await updateNotificationWebhook('webhook-1', { enabled: false })

    const [url, init] = lastCall()
    expect(url).toContain('/notification-webhooks/webhook-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ enabled: false })
  })

  it('deletes a webhook by id', async () => {
    await deleteNotificationWebhook('webhook-1')

    const [url, init] = lastCall()
    expect(url).toContain('/notification-webhooks/webhook-1')
    expect(init.method).toBe('DELETE')
  })

  it('posts a test message to the webhook test sub-path', async () => {
    await testNotificationWebhook('webhook-1')

    const [url, init] = lastCall()
    expect(url).toContain('/notification-webhooks/webhook-1/test')
    expect(init.method).toBe('POST')
  })
})
