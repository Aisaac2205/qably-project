'use client'

import { useSyncExternalStore } from 'react'
import {
  getNotifications,
  getServerNotifications,
  markNotificationAsRead,
  toggleNotificationRead,
  markAllNotificationsAsRead,
  subscribe,
} from '@/lib/mock-store'

export function useNotifications() {
  const notifications = useSyncExternalStore(subscribe, getNotifications, getServerNotifications)
  const unreadCount = notifications.filter((notification) => !notification.readAt).length

  return {
    notifications,
    unreadCount,
    markAsRead: markNotificationAsRead,
    toggleRead: toggleNotificationRead,
    markAllAsRead: markAllNotificationsAsRead,
  }
}
