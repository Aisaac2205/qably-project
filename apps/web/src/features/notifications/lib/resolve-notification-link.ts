import type { Notification } from '@qably/types'

/**
 * Maps a notification to the screen that actually resolves its target, per
 * roadmap §7 ("no alert dead-ends on an ambiguous screen"). Returns
 * `undefined` when no such screen exists yet — the row then renders as
 * non-navigable instead of linking to a broken or ambiguous destination.
 */
export function resolveNotificationLink(notification: Notification): string | undefined {
  switch (notification.eventType) {
    case 'run_failed':
    case 'run_completed':
    case 'case_regressed':
      if (notification.projectId && notification.runId) {
        return `/projects/${notification.projectId}/runs/${notification.runId}`
      }
      return undefined
    case 'ingestion_failed':
      if (notification.projectId) {
        return `/projects/${notification.projectId}/repository`
      }
      return undefined
    case 'connection_security':
      return undefined
    default:
      return undefined
  }
}
