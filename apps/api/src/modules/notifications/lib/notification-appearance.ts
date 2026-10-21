import type { NotificationEventType } from '@qably/types';

export const NOTIFICATION_NEUTRAL_COLOR = '#5865F2';

/** The color of an event that means something was lost or did not run. */
export const NOTIFICATION_FAILURE_COLOR = '#E74C3C';

const COLOR_BY_EVENT: Record<NotificationEventType, string> = {
  run_completed: '#2ECC71',
  run_failed: NOTIFICATION_FAILURE_COLOR,
  case_regressed: '#F1C40F',
  ingestion_failed: NOTIFICATION_FAILURE_COLOR,
  connection_security: NOTIFICATION_NEUTRAL_COLOR,
  proposals_ready: NOTIFICATION_NEUTRAL_COLOR,
  extraction_capped: NOTIFICATION_FAILURE_COLOR,
};

export function notificationColor(eventType: NotificationEventType): string {
  return COLOR_BY_EVENT[eventType];
}
