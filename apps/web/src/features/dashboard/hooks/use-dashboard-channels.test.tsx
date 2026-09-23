import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { DashboardChannelsRecord } from '@qably/types'
import { useDashboardChannels } from './use-dashboard-channels'
import { getDashboardChannels } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'
import { useBrowserTimeZone } from '@/lib/time-zone'

vi.mock('../api/dashboard.api', () => ({ getDashboardChannels: vi.fn() }))

vi.mock('@/lib/time-zone', async () => {
  const actual = await vi.importActual<typeof import('@/lib/time-zone')>('@/lib/time-zone')
  return { ...actual, useBrowserTimeZone: vi.fn() }
})

const fetchChannels = vi.mocked(getDashboardChannels)
const browserTimeZone = vi.mocked(useBrowserTimeZone)

const channels: DashboardChannelsRecord = {
  webhooks: [],
  email: { enabled: false, eventTypes: [], sent: 0, failed: 0, daily: [] },
  inApp: { sent: 0, unread: 0, daily: [] },
  lastDelivery: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchChannels.mockResolvedValue(channels)
})

describe('useDashboardChannels', () => {
  it('never queries while the browser time zone has not resolved (server snapshot)', () => {
    browserTimeZone.mockReturnValue(undefined)

    const { result } = renderHook(() => useDashboardChannels(), { wrapper })

    expect(fetchChannels).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(true)
  })

  it('queries with the resolved browser time zone once it is available', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')

    renderHook(() => useDashboardChannels(), { wrapper })

    await waitFor(() =>
      expect(fetchChannels).toHaveBeenCalledWith('America/Guatemala', expect.anything()),
    )
  })

  it('keys the query by time zone', async () => {
    browserTimeZone.mockReturnValue('Asia/Tokyo')

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

    renderHook(() => useDashboardChannels(), { wrapper: localWrapper })

    await waitFor(() =>
      expect(client.getQueryData(dashboardKeys.channels('Asia/Tokyo'))).toEqual(channels),
    )
  })

  it('surfaces an error state without throwing', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')
    fetchChannels.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useDashboardChannels(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.channels).toBeUndefined()
  })
})
