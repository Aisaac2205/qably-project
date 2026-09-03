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
