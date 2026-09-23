import { describe, it, expect } from 'vitest'
import type { DashboardChannelsRecord } from '@qably/types'
import { resolveLastDeliveryWebhookName } from '@/features/dashboard/lib/resolve-last-delivery'

function channels(overrides: Partial<DashboardChannelsRecord>): DashboardChannelsRecord {
  return {
    webhooks: [],
    email: { enabled: false, eventTypes: [], sent: 0, failed: 0, daily: [] },
    inApp: { sent: 0, unread: 0, daily: [] },
    lastDelivery: null,
    ...overrides,
  }
}

describe('resolveLastDeliveryWebhookName', () => {
  it('returns undefined when there is no last delivery', () => {
    expect(resolveLastDeliveryWebhookName(channels({}))).toBeUndefined()
  })

  it('resolves the webhook name matching lastDelivery.webhookId', () => {
    const record = channels({
      webhooks: [
        {
          id: 'webhook-1',
          type: 'slack',
          name: 'Team Slack',
          eventTypes: ['run_failed'],
          sent: 1,
          failed: 0,
          daily: [],
        },
      ],
      lastDelivery: {
        webhookId: 'webhook-1',
        channel: 'slack',
        eventType: 'run_failed',
        status: 'sent',
        deliveredAt: '2026-06-15T10:00:00.000Z',
      },
    })

    expect(resolveLastDeliveryWebhookName(record)).toBe('Team Slack')
  })

  it('returns undefined when the delivery references a webhook no longer in scope', () => {
    const record = channels({
      webhooks: [],
      lastDelivery: {
        webhookId: 'webhook-missing',
        channel: 'slack',
        eventType: 'run_failed',
        status: 'sent',
        deliveredAt: '2026-06-15T10:00:00.000Z',
      },
    })

    expect(resolveLastDeliveryWebhookName(record)).toBeUndefined()
  })

  it('returns undefined for an email delivery, leaving the caller to label it', () => {
    const record = channels({
      lastDelivery: {
        webhookId: null,
        channel: 'email',
        eventType: 'case_regressed',
        status: 'sent',
        deliveredAt: '2026-06-15T10:00:00.000Z',
      },
    })

    expect(resolveLastDeliveryWebhookName(record)).toBeUndefined()
  })
})
