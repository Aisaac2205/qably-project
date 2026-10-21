'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Notification } from '@qably/types'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'
import { notificationKeys } from '../lib/query-keys'

const EMPTY: Notification[] = []

/** How often the list is refreshed while the tab is visible. */
export const NOTIFICATIONS_REFRESH_MS = 30_000

/**
 * Shorter than the refresh interval, so coming back to the tab after a while
 * refetches at once, while quick tab flips do not hit the api every time.
 */
const NOTIFICATIONS_STALE_MS = 15_000

export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: notificationKeys.all,
    queryFn: ({ signal }) => listNotifications(signal),
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchInterval: NOTIFICATIONS_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  const notifications = query.data ?? EMPTY
  const unreadCount = notifications.filter((notification) => !notification.readAt).length

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<Notification[]>(notificationKeys.all, (current) =>
        (current ?? EMPTY).map((notification) =>
          notification.id === updated.id ? updated : notification,
        ),
      )
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      const readAt = new Date().toISOString()
      queryClient.setQueryData<Notification[]>(notificationKeys.all, (current) =>
        (current ?? EMPTY).map((notification) =>
          notification.readAt ? notification : { ...notification, readAt },
        ),
      )
    },
  })

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    /**
     * True while the cache holds a response, so an empty list is real and not a
     * placeholder. It stays true through a failed refetch and drops again only
     * when the cache is reset, as it is when the organization changes.
     */
    hasLoaded: query.data !== undefined,
    markAsRead: (id: string) => {
      markReadMutation.mutate(id)
    },
    markAllAsRead: () => {
      markAllReadMutation.mutate()
    },
  }
}
