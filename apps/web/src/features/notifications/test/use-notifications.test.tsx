import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'

describe('useNotifications', () => {
  beforeEach(() => __resetStore())

  it('returns unread seeded notifications and marks one as read', () => {
    const { result } = renderHook(() => useNotifications())

    expect(result.current.unreadCount).toBe(2)

    act(() => result.current.markAsRead('notification-1'))

    expect(result.current.unreadCount).toBe(1)
    expect(result.current.notifications.find((item) => item.id === 'notification-1')?.readAt).toBeDefined()
  })
})
