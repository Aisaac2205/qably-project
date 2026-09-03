import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Notification } from '@qably/types'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api/notifications.api'

vi.mock('@/features/notifications/api/notifications.api', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const list = vi.mocked(listNotifications)
const markRead = vi.mocked(markNotificationRead)
const markAllRead = vi.mocked(markAllNotificationsRead)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const unread: Notification = {
  id: 'notification-1',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'run_failed',
  severity: 'critical',
  payload: { runName: 'Run #12', suiteName: 'Checkout' },
  projectId: 'proj-1',
  runId: 'run-12',
  createdAt: '2026-06-16T10:42:00Z',
}

const read: Notification = {
  ...unread,
  id: 'notification-2',
  readAt: '2026-06-16T11:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([unread, read])
})

describe('useNotifications', () => {
  it('starts empty so the menu can render before the request settles', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })

  it('returns the notifications the api served and counts the unread ones', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    await waitFor(() => expect(result.current.notifications).toEqual([unread, read]))
    expect(result.current.unreadCount).toBe(1)
  })

  it('marks a single notification as read', async () => {
    markRead.mockResolvedValue({ ...unread, readAt: '2026-06-16T12:00:00Z' })
    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications).toHaveLength(2))

    await act(async () => {
      result.current.markAsRead('notification-1')
    })

    expect(markRead).toHaveBeenCalledWith('notification-1')
    await waitFor(() =>
      expect(result.current.notifications.find((n) => n.id === 'notification-1')?.readAt).toBe(
        '2026-06-16T12:00:00Z',
      ),
    )
    expect(result.current.unreadCount).toBe(0)
  })

  it('marks every notification as read', async () => {
    markAllRead.mockResolvedValue(undefined)
    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications).toHaveLength(2))

    await act(async () => {
      result.current.markAllAsRead()
    })

    expect(markAllRead).toHaveBeenCalled()
    await waitFor(() => expect(result.current.unreadCount).toBe(0))
  })
})
