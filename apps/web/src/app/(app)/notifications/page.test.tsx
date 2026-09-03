import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '@qably/types'
import { renderWithQuery } from '@/lib/query-test-utils'
import {
  listNotifications,
  markAllNotificationsRead,
} from '@/features/notifications/api/notifications.api'
import NotificationsPage from './page'

vi.mock('@/features/notifications/api/notifications.api', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const list = vi.mocked(listNotifications)
const markAllRead = vi.mocked(markAllNotificationsRead)

const runFailed: Notification = {
  id: 'notification-1',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'run_failed',
  severity: 'critical',
  payload: { runName: '#12', suiteName: 'Auth' },
  projectId: 'proj-1',
  runId: 'run-12',
  createdAt: '2026-06-16T10:42:00Z',
}

const caseRegressed: Notification = {
  id: 'notification-3',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'case_regressed',
  severity: 'high',
  payload: { caseName: 'Discount calculation', suiteName: 'Checkout', runName: '#10' },
  projectId: 'proj-1',
  runId: 'run-10',
  createdAt: '2026-06-14T09:12:00Z',
  readAt: '2026-06-14T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([runFailed, caseRegressed])
})

describe('NotificationsPage', () => {
  it('renders the interactive notifications center with real notifications and action links', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<NotificationsPage />)
    })

    await waitFor(() =>
      expect(screen.getByText('The run "#12" in Auth failed.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('tab', { name: /unread/i })).toBeInTheDocument()

    const runLinks = screen.getAllByRole('link', { name: /view details/i })
    expect(runLinks.length).toBeGreaterThan(0)
    expect(runLinks[0]).toHaveAttribute('href', '/projects/proj-1/runs/run-12')

    await user.click(screen.getByRole('tab', { name: 'Read' }))
    expect(
      screen.getByText('Discount calculation regressed in Checkout during run "#10".'),
    ).toBeInTheDocument()
    expect(screen.queryByText('The run "#12" in Auth failed.')).not.toBeInTheDocument()
  })

  it('allows marking all notifications as read', async () => {
    const user = userEvent.setup()
    markAllRead.mockResolvedValue(undefined)
    await act(async () => {
      renderWithQuery(<NotificationsPage />)
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /mark all as read/i }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument(),
    )
  })
})
