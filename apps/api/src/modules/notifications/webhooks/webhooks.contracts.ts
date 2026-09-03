import type {
  NotificationEventType,
  NotificationWebhook,
  NotificationWebhookType,
} from '@qably/types';

export type NotificationWebhookView = NotificationWebhook;

export type NotificationWebhookError = 'not-found' | 'forbidden';

export interface NotificationWebhookRow {
  id: string;
  organizationId: string;
  type: NotificationWebhookType;
  name: string;
  encryptedUrl: string;
  enabled: boolean;
  eventTypes: NotificationEventType[];
  createdAt: Date;
  updatedAt: Date;
}
