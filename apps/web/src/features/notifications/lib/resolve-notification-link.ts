import type { Notification } from '@qably/types'

function payloadId(notification: Notification, key: string): string | undefined {
  const value = notification.payload[key]
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * `/review-inbox` narrowed to one project and, when the notification names
 * it, to the batch of proposals that triggered it. The batch filter is read
 * back by `useReviewInboxFilters`.
 */
function proposalsReadyLink(notification: Notification): string | undefined {
  const projectId = payloadId(notification, 'projectId') ?? notification.projectId
  if (!projectId) return undefined

  const params = new URLSearchParams({ projectId })
  const batchId = payloadId(notification, 'batchId')
  if (batchId) params.set('batch', batchId)

  return `/review-inbox?${params.toString()}`
}

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
    case 'proposals_ready':
      return proposalsReadyLink(notification)
    case 'extraction_capped': {
      const projectId = notification.projectId ?? payloadId(notification, 'projectId')
      return projectId ? `/projects/${projectId}/repository` : undefined
    }
    case 'connection_security':
      return undefined
    default:
      return undefined
  }
}
