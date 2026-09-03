import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useNotificationPreferences } from '@/features/notifications/hooks/use-notification-preferences'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferenceView,
} from '@/features/notifications/api/notifications.api'

vi.mock('@/features/notifications/api/notifications.api', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

const getPrefs = vi.mocked(getNotificationPreferences)
const updatePrefs = vi.mocked(updateNotificationPreferences)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const caseRegressedEmailOn: NotificationPreferenceView = {
  id: 'pref-1',
  userId: 'user-1',
  organizationId: 'org-1',
  eventType: 'case_regressed',
  channel: 'email',
  enabled: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  getPrefs.mockResolvedValue([caseRegressedEmailOn])
})

describe('useNotificationPreferences', () => {
  it('starts empty so the panel can render before the request settles', () => {
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper })
    expect(result.current.preferences).toEqual([])
  })

  it('returns the preferences the api served', async () => {
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper })
    await waitFor(() => expect(result.current.preferences).toEqual([caseRegressedEmailOn]))
  })

  it('sends the update and replaces the cache with the server response', async () => {
    const updated: NotificationPreferenceView = { ...caseRegressedEmailOn, enabled: false }
    updatePrefs.mockResolvedValue([updated])
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper })
    await waitFor(() => expect(result.current.preferences).toEqual([caseRegressedEmailOn]))

    await act(async () => {
      await result.current.updatePreferences({
        preferences: [{ eventType: 'case_regressed', channel: 'email', enabled: false }],
      })
    })

    expect(updatePrefs).toHaveBeenCalledWith({
      preferences: [{ eventType: 'case_regressed', channel: 'email', enabled: false }],
    })
    await waitFor(() => expect(result.current.preferences).toEqual([updated]))
  })
})
