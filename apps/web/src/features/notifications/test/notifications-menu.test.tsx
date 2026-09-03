import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Notification } from '@qably/types'
import { NotificationsMenu } from '@/features/notifications/components/notifications-menu'
import {
  listNotifications,
  markNotificationRead,
} from '@/features/notifications/api/notifications.api'

vi.mock('@/features/notifications/api/notifications.api', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const list = vi.mocked(listNotifications)
const markRead = vi.mocked(markNotificationRead)

const unread: Notification = {
  id: 'notification-1',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'run_failed',
  severity: 'critical',
  payload: { runName: '#12', suiteName: 'Checkout' },
  projectId: 'proj-1',
  runId: 'run-12',
  createdAt: '2026-06-16T10:42:00Z',
}

const read: Notification = {
  ...unread,
  id: 'notification-2',
  eventType: 'case_regressed',
  severity: 'high',
  payload: { caseName: 'Discount total', suiteName: 'Checkout', runName: '#10' },
  readAt: '2026-06-14T10:00:00Z',
}

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return render(<NotificationsMenu />, { wrapper: Wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([unread, read])
})

describe('NotificationsMenu', () => {
  it('shows unread notifications rendered from the event catalog and marks one as read', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderMenu()
    })

    await user.click(await screen.findByRole('button', { name: /notifications, 1 unread/i }))
    expect(
      await screen.findByText('The run "#12" in Checkout failed.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()

    markRead.mockResolvedValue({ ...unread, readAt: '2026-06-16T12:00:00Z' })
    await user.click(screen.getByText('The run "#12" in Checkout failed.'))

    expect(markRead).toHaveBeenCalledWith('notification-1')
  })
})
