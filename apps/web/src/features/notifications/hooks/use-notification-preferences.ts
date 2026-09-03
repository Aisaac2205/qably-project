'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferenceView,
  type UpdateNotificationPreferencesPayload,
} from '../api/notifications.api'
import { notificationKeys } from '../lib/query-keys'

const EMPTY: NotificationPreferenceView[] = []

export function useNotificationPreferences() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: ({ signal }) => getNotificationPreferences(signal),
  })

  const mutation = useMutation({
    mutationFn: (payload: UpdateNotificationPreferencesPayload) =>
      updateNotificationPreferences(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(notificationKeys.preferences, updated)
    },
  })

  return {
    preferences: query.data ?? EMPTY,
    isLoading: query.isLoading,
    updatePreferences: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}
