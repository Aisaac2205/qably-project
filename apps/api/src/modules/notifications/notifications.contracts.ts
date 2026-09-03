import type {
  Notification,
  NotificationEventType,
  NotificationPreference,
  NotificationSeverity,
} from '@qably/types';

export const NOTIFICATIONS_QUEUE = 'notifications';

export type NotificationView = Notification;

export type NotificationPreferenceView = NotificationPreference;

export type NotificationError = 'not-found' | 'forbidden';

export interface NotificationJobData {
  eventType: NotificationEventType;
  organizationId: string;
  severity: NotificationSeverity;
  payload: Record<string, string | number>;
  dedupeKey: string;
  projectId?: string;
  runId?: string;
  testCaseId?: string;
  ingestionBatchId?: string;
  connectionId?: string;
}
