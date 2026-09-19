import type { NotificationEventType } from '@qably/types';

export const NOTIFICATION_NEUTRAL_COLOR = '#5865F2';

const COLOR_BY_EVENT: Record<NotificationEventType, string> = {
  run_completed: '#2ECC71',
  run_failed: '#E74C3C',
  case_regressed: '#F1C40F',
  ingestion_failed: '#E74C3C',
  connection_security: NOTIFICATION_NEUTRAL_COLOR,
};

export function notificationColor(eventType: NotificationEventType): string {
  return COLOR_BY_EVENT[eventType];
}
