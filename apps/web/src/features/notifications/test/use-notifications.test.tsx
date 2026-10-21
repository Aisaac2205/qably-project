import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  deliveries: [],
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

  it('tells a settled empty list apart from one that has not loaded yet', async () => {
    list.mockResolvedValue([])
    const { result } = renderHook(() => useNotifications(), { wrapper })

    expect(result.current.hasLoaded).toBe(false)
    await waitFor(() => expect(result.current.hasLoaded).toBe(true))
    expect(result.current.notifications).toEqual([])
  })
})

describe('useNotifications refresh', () => {
  const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
  let tabState: 'visible' | 'hidden'

  function stableWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return function StableWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
  }

  function setTabState(next: 'visible' | 'hidden') {
    tabState = next
    window.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    tabState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => tabState,
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    if (visibility) Object.defineProperty(Document.prototype, 'visibilityState', visibility)
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('asks the api again every 30 seconds while the tab is visible', async () => {
    renderHook(() => useNotifications(), { wrapper: stableWrapper() })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(list).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('does not poll while the tab is in the background', async () => {
    renderHook(() => useNotifications(), { wrapper: stableWrapper() })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))

    setTabState('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })

    expect(list).toHaveBeenCalledTimes(1)
  })

  it('refreshes as soon as the user comes back to the tab', async () => {
    renderHook(() => useNotifications(), { wrapper: stableWrapper() })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))

    setTabState('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    setTabState('visible')

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })
})
