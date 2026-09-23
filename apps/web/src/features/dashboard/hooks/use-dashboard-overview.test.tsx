import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { DashboardOverviewRecord, DashboardPeriod } from '@qably/types'
import { useDashboardOverview } from './use-dashboard-overview'
import { getDashboardOverview } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'
import { useBrowserTimeZone } from '@/lib/time-zone'

vi.mock('../api/dashboard.api', () => ({ getDashboardOverview: vi.fn() }))

vi.mock('@/lib/time-zone', async () => {
  const actual = await vi.importActual<typeof import('@/lib/time-zone')>('@/lib/time-zone')
  return { ...actual, useBrowserTimeZone: vi.fn() }
})

const fetchOverview = vi.mocked(getDashboardOverview)
const browserTimeZone = vi.mocked(useBrowserTimeZone)

const overview: DashboardOverviewRecord = {
  period: 30,
  timeZone: 'America/Guatemala',
  kpis: {
    passRate: { value: 0.8, previous: 0.7, series: [] },
    runs: { value: 10, previous: 8, series: [] },
    failedCases: { value: 2, previous: 3, series: [] },
    avgRunDurationMs: { value: 1000, previous: 1200, series: [] },
  },
  passRateSeries: { current: [], previous: [] },
  casesPassing: { total: 0, pending: 0, running: 0, pass: 0, fail: 0, skip: 0, blocked: 0 },
  projects: [],
  recentActivity: [],
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchOverview.mockResolvedValue(overview)
})

describe('useDashboardOverview', () => {
  it('never queries while the browser time zone has not resolved (server snapshot)', () => {
    browserTimeZone.mockReturnValue(undefined)

    const { result } = renderHook(() => useDashboardOverview(30), { wrapper })

    expect(fetchOverview).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(true)
  })

  it('queries with the resolved browser time zone once it is available', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')

    renderHook(() => useDashboardOverview(30), { wrapper })

    await waitFor(() =>
      expect(fetchOverview).toHaveBeenCalledWith(
        30,
        'America/Guatemala',
        undefined,
        expect.anything(),
      ),
    )
  })

  it('scopes the query to one project when projectId is given', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')

    renderHook(() => useDashboardOverview(30, 'project-1'), { wrapper })

    await waitFor(() =>
      expect(fetchOverview).toHaveBeenCalledWith(
        30,
        'America/Guatemala',
        'project-1',
        expect.anything(),
      ),
    )
  })

  it('refetches when the period changes', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')

    const { rerender } = renderHook(
      ({ period }: { period: DashboardPeriod }) => useDashboardOverview(period),
      {
        wrapper,
        initialProps: { period: 30 },
      },
    )

    await waitFor(() => expect(fetchOverview).toHaveBeenCalledTimes(1))

    rerender({ period: 7 })

    await waitFor(() => expect(fetchOverview).toHaveBeenCalledTimes(2))
    expect(fetchOverview).toHaveBeenLastCalledWith(
      7,
      'America/Guatemala',
      undefined,
      expect.anything(),
    )
  })

  it('keys the query by period, projectId and time zone', async () => {
    browserTimeZone.mockReturnValue('Asia/Tokyo')

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

    renderHook(() => useDashboardOverview(30), { wrapper: localWrapper })

    await waitFor(() =>
      expect(
        client.getQueryData(dashboardKeys.overview(30, 'all', 'Asia/Tokyo')),
      ).toEqual(overview),
    )
  })

  it('surfaces an error state without throwing', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')
    fetchOverview.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useDashboardOverview(30), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.overview).toBeUndefined()
  })
})
