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

export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: notificationKeys.all,
    queryFn: ({ signal }) => listNotifications(signal),
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
    markAsRead: (id: string) => {
      markReadMutation.mutate(id)
    },
    markAllAsRead: () => {
      markAllReadMutation.mutate()
    },
  }
}
