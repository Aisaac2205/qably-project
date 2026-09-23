import { DEFAULT_NOTIFICATION_PREFERENCES } from '@qably/types';
import type {
  DashboardChannelDailyPoint,
  DashboardChannelsRecord,
  DashboardEmailChannel,
  DashboardInAppChannel,
  DashboardWebhookChannel,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationWebhookType,
} from '@qably/types';

export const CHANNELS_WINDOW_DAYS = 14;

export interface WebhookRow {
  id: string;
  type: NotificationWebhookType;
  name: string;
  eventTypes: NotificationEventType[];
}

export interface DeliveryCountRow {
  webhookId: string;
  day: string;
  status: NotificationDeliveryStatus;
  count: number;
}

export interface PreferenceRow {
  eventType: NotificationEventType;
  enabled: boolean;
}

export interface LastDeliveryRow {
  webhookId: string | null;
  channel: NotificationChannel;
  eventType: NotificationEventType;
  status: NotificationDeliveryStatus;
  deliveredAt: Date;
}

export interface InAppCountRow {
  day: string;
  sent: number;
  unread: number;
}

export interface EmailDeliveryCountRow {
  day: string;
  status: NotificationDeliveryStatus;
  count: number;
}

export interface BuildDashboardChannelsInput {
  dayKeys: readonly string[];
  webhooks: readonly WebhookRow[];
  deliveryCountRows: readonly DeliveryCountRow[];
  emailPreferenceRows: readonly PreferenceRow[];
  emailDeliveryCountRows?: readonly EmailDeliveryCountRow[];
  inAppCountRows?: readonly InAppCountRow[];
  lastDelivery: LastDeliveryRow | null;
}

function emptyDailyPoint(date: string): DashboardChannelDailyPoint {
  return { date, sent: 0, failed: 0 };
}

function buildWebhookChannel(
  webhook: WebhookRow,
  dayKeys: readonly string[],
  deliveryCountRows: readonly DeliveryCountRow[],
): DashboardWebhookChannel {
  const dailyByDate = new Map<string, DashboardChannelDailyPoint>();
  for (const day of dayKeys) dailyByDate.set(day, emptyDailyPoint(day));

  let sent = 0;
  let failed = 0;

  for (const row of deliveryCountRows) {
    if (row.webhookId !== webhook.id) continue;
    const point = dailyByDate.get(row.day);
    if (point === undefined) continue;

    if (row.status === 'sent') {
      point.sent += row.count;
      sent += row.count;
    } else {
      point.failed += row.count;
      failed += row.count;
    }
  }

  return {
    id: webhook.id,
    type: webhook.type,
    name: webhook.name,
    eventTypes: webhook.eventTypes,
    sent,
    failed,
    daily: dayKeys.map(
      (day) => dailyByDate.get(day) as DashboardChannelDailyPoint,
    ),
  };
}

function buildEmailChannel(
  dayKeys: readonly string[],
  emailPreferenceRows: readonly PreferenceRow[],
  emailDeliveryCountRows: readonly EmailDeliveryCountRow[],
): DashboardEmailChannel {
  const overrideByEventType = new Map(
    emailPreferenceRows.map((row) => [row.eventType, row.enabled]),
  );

  const eventTypes = (
    Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as NotificationEventType[]
  ).filter((eventType) => {
    const override = overrideByEventType.get(eventType);
    return override ?? DEFAULT_NOTIFICATION_PREFERENCES[eventType].email;
  });

  const dailyByDate = new Map<string, DashboardChannelDailyPoint>();
  for (const day of dayKeys) dailyByDate.set(day, emptyDailyPoint(day));

  let sent = 0;
  let failed = 0;

  for (const row of emailDeliveryCountRows) {
    const point = dailyByDate.get(row.day);
    if (point === undefined) continue;

    if (row.status === 'sent') {
      point.sent += row.count;
      sent += row.count;
    } else {
      point.failed += row.count;
      failed += row.count;
    }
  }

  return {
    enabled: eventTypes.length > 0,
    eventTypes,
    sent,
    failed,
    daily: dayKeys.map(
      (day) => dailyByDate.get(day) as DashboardChannelDailyPoint,
    ),
  };
}

function buildInAppChannel(
  dayKeys: readonly string[],
  inAppCountRows: readonly InAppCountRow[],
): DashboardInAppChannel {
  const dailyByDate = new Map<string, DashboardChannelDailyPoint>();
  for (const day of dayKeys) dailyByDate.set(day, emptyDailyPoint(day));

  let sent = 0;
  let unread = 0;

  for (const row of inAppCountRows) {
    const point = dailyByDate.get(row.day);
    if (point === undefined) continue;

    point.sent += row.sent;
    sent += row.sent;
    unread += row.unread;
  }

  return {
    sent,
    unread,
    daily: dayKeys.map(
      (day) => dailyByDate.get(day) as DashboardChannelDailyPoint,
    ),
  };
}

export function buildDashboardChannels(
  input: BuildDashboardChannelsInput,
): DashboardChannelsRecord {
  return {
    webhooks: input.webhooks.map((webhook) =>
      buildWebhookChannel(webhook, input.dayKeys, input.deliveryCountRows),
    ),
    email: buildEmailChannel(
      input.dayKeys,
      input.emailPreferenceRows,
      input.emailDeliveryCountRows ?? [],
    ),
    inApp: buildInAppChannel(input.dayKeys, input.inAppCountRows ?? []),
    lastDelivery:
      input.lastDelivery === null
        ? null
        : {
            webhookId: input.lastDelivery.webhookId,
            channel: input.lastDelivery.channel,
            eventType: input.lastDelivery.eventType,
            status: input.lastDelivery.status,
            deliveredAt: input.lastDelivery.deliveredAt.toISOString(),
          },
  };
}
