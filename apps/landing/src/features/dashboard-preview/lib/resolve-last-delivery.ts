import type { DashboardChannelsRecord } from '@qably/types'

export function resolveLastDeliveryWebhookName(
  channels: DashboardChannelsRecord,
): string | undefined {
  if (channels.lastDelivery === null) return undefined
  if (channels.lastDelivery.channel === 'email') return undefined

  return channels.webhooks.find(
    (webhook) => webhook.id === channels.lastDelivery?.webhookId,
  )?.name
}
