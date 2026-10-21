import { describe, expect, it } from 'vitest'
import type { Notification } from '@qably/types'
import { resolveNotificationLink } from '@/features/notifications/lib/resolve-notification-link'

function baseNotification(overrides: Partial<Notification>): Notification {
  return {
    id: 'notification-1',
    organizationId: 'org-1',
    userId: 'user-1',
    eventType: 'run_failed',
    severity: 'critical',
    payload: {},
    createdAt: '2026-06-16T10:42:00Z',
    deliveries: [],
    ...overrides,
  }
}

describe('resolveNotificationLink', () => {
  it('links run_failed to the run detail page', () => {
    const notification = baseNotification({
      eventType: 'run_failed',
      projectId: 'proj-1',
      runId: 'run-12',
    })
    expect(resolveNotificationLink(notification)).toBe('/projects/proj-1/runs/run-12')
  })

  it('links run_completed to the run detail page', () => {
    const notification = baseNotification({
      eventType: 'run_completed',
      projectId: 'proj-1',
      runId: 'run-9',
    })
    expect(resolveNotificationLink(notification)).toBe('/projects/proj-1/runs/run-9')
  })

  it('links case_regressed to the run that carried the regression', () => {
    const notification = baseNotification({
      eventType: 'case_regressed',
      projectId: 'proj-1',
      runId: 'run-14',
      testCaseId: 'tc-3',
    })
    expect(resolveNotificationLink(notification)).toBe('/projects/proj-1/runs/run-14')
  })

  it('links ingestion_failed to the project repository page', () => {
    const notification = baseNotification({
      eventType: 'ingestion_failed',
      projectId: 'proj-1',
      ingestionBatchId: 'batch-1',
    })
    expect(resolveNotificationLink(notification)).toBe('/projects/proj-1/repository')
  })

  it('links proposals_ready to the review inbox filtered to its project and batch', () => {
    const notification = baseNotification({
      eventType: 'proposals_ready',
      payload: { source: 'push', count: 18, projectId: 'proj-1', batchId: 'batch-7' },
    })
    expect(resolveNotificationLink(notification)).toBe(
      '/review-inbox?projectId=proj-1&batch=batch-7',
    )
  })

  it('falls back to the notification project when the proposals_ready payload has none', () => {
    const notification = baseNotification({
      eventType: 'proposals_ready',
      projectId: 'proj-2',
      payload: { source: 'chat', count: 3, batchId: 'batch-9' },
    })
    expect(resolveNotificationLink(notification)).toBe(
      '/review-inbox?projectId=proj-2&batch=batch-9',
    )
  })

  it('opens the project queue without a batch filter when the payload carries no batch', () => {
    const notification = baseNotification({
      eventType: 'proposals_ready',
      payload: { source: 'documentation', count: 4, projectId: 'proj-1' },
    })
    expect(resolveNotificationLink(notification)).toBe('/review-inbox?projectId=proj-1')
  })

  it('encodes ids that are not URL safe in the proposals_ready link', () => {
    const notification = baseNotification({
      eventType: 'proposals_ready',
      payload: { source: 'push', count: 1, projectId: 'proj 1', batchId: 'a&b=c' },
    })
    expect(resolveNotificationLink(notification)).toBe(
      '/review-inbox?projectId=proj+1&batch=a%26b%3Dc',
    )
  })

  it('has no destination for proposals_ready when no project can be resolved', () => {
    const notification = baseNotification({
      eventType: 'proposals_ready',
      payload: { source: 'push', count: 18, batchId: 'batch-7' },
    })
    expect(resolveNotificationLink(notification)).toBeUndefined()
  })

  it('links extraction_capped to the project repository page', () => {
    const notification = baseNotification({
      eventType: 'extraction_capped',
      projectId: 'proj-1',
      payload: { count: 120, limit: 50, projectId: 'proj-1', batchId: 'batch-7' },
    })
    expect(resolveNotificationLink(notification)).toBe('/projects/proj-1/repository')
  })

  it('falls back to the extraction_capped payload project when the notification has none', () => {
    const notification = baseNotification({
      eventType: 'extraction_capped',
      payload: { count: 120, limit: 50, projectId: 'proj-2', batchId: 'batch-7' },
    })
    expect(resolveNotificationLink(notification)).toBe('/projects/proj-2/repository')
  })

  it('has no destination for extraction_capped when no project can be resolved', () => {
    const notification = baseNotification({
      eventType: 'extraction_capped',
      payload: { count: 120, limit: 50 },
    })
    expect(resolveNotificationLink(notification)).toBeUndefined()
  })

  it('has no resolvable destination for connection_security yet', () => {
    const notification = baseNotification({
      eventType: 'connection_security',
      connectionId: 'conn-1',
    })
    expect(resolveNotificationLink(notification)).toBeUndefined()
  })

  it('returns undefined when the required target id is missing', () => {
    const notification = baseNotification({ eventType: 'run_failed', projectId: 'proj-1' })
    expect(resolveNotificationLink(notification)).toBeUndefined()
  })
})
